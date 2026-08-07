# Cost tracking

**Status: proposed design, not yet running in production.** Fixed infra cost is already known ($6/month); variable Claude API cost has not been logged per run. The app already has an observability pattern to extend rather than replace — a `job_runs` table and Agent Status page tracking four background agents (`signal`, `realise`, `synthesis`, `alpha` — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-signals-subsystem--agentic-ripple)). This document proposes a fifth job type, `cost`, using the same table and the same logging endpoint proposed in [EVALUATION.md](./EVALUATION.md#the-one-backend-addition-this-needs-expose-recordjobrun-over-the-api). Together they give a real per-brief and per-subscriber unit cost — the number that actually matters if anyone asks "does this scale."

## Current known costs

| Item | Cost | Notes |
|---|---|---|
| n8n host (DigitalOcean droplet) | $6/month | Fixed |
| Web app hosting (Render) | $0 (free tier) | |
| Database (Neon/Supabase, incl. pgvector) | $0 (free tier) | |
| Tavily search API | $0 (free tier) | Confirmed comfortably within free-tier limits |
| Telegram Bot API | $0 | Free |
| Claude API — core daily brief (Tavily results → 8-section brief) | **~$0.40/brief**, ~6 briefs/week (Mon–Sat) → **~$10.40/month** | Estimated, not yet logged per run — see the framework below to make this exact |
| Claude API — Signals agents (theme synthesis, weekly, all windows) | **~$1.60/month** | Down from ~$4.25/month after moving off a daily cadence and adding prompt caching — see [ARCHITECTURE.md](./ARCHITECTURE.md#cadence-is-a-cost-decision-not-just-a-freshness-one) |
| Claude API — house view (`alpha`, daily, one Sonnet call) | **~$0.20/month** | Kept daily deliberately; freshness matters more here than cost |
| Claude API — realisation sweep (`realise`, weekly, Haiku verdicts) | Not yet isolated | Bundled into the weekly sweep; small, but not broken out from synthesis cost yet |

**Total: ~$6/month fixed + ~$12.20/month variable ≈ $18/month all-in**, or roughly **$0.33 per subscriber per month** at the current 55. The core-brief figure ($0.40/run) is a manual estimate, not a logged number — closing that gap, and isolating the `realise` job's own cost, is what the rest of this document proposes.

## Framework: log cost at the point of the API call

The Claude Messages API returns token usage on every response:

```json
{
  "usage": {
    "input_tokens": 4213,
    "output_tokens": 1842
  }
}
```

(If prompt caching is in use, `cache_creation_input_tokens` and `cache_read_input_tokens` also appear — cache reads are billed at a different, lower rate, so they're broken out separately below.)

That's enough to compute an exact dollar cost per run, with no estimation, as long as the node making the call is configured to expose the raw response (an HTTP Request node calling `api.anthropic.com/v1/messages` directly does this natively; n8n's built-in AI Agent/LangChain-style node may not surface `usage` the same way — if the synthesis step currently uses that node type, either switch the underlying call to a raw HTTP Request node, or check whether the node's output includes token metadata under a different key before wiring the nodes below).

## Where this sits in the pipeline

```
Claude — Synthesis (HTTP Request node, raw Messages API call)
      ↓
Cost: Extract Token Usage
      ↓
Cost: Compute Run Cost  ──→  Cost: Log Run ──→ POST /api/trpc/n8n.logJobRun (job: "cost")
      ↓                                          → same job_runs table + Agent Status page
(continues to Eval nodes / Validate Brief Schema / publish, unchanged)
```

## Node 1 — `Cost: Extract Token Usage` (Code node)

```javascript
// Cost: Extract Token Usage
// Pulls usage + model metadata straight off the raw Anthropic API response.
// Requires the synthesis call to be a raw HTTP Request node hitting
// api.anthropic.com/v1/messages (not the abstracted AI Agent node) so the
// full response, including `usage`, is available here.

const response = $node["Claude — Synthesis"].json;

const usage = response?.usage || {};

return [{
  json: {
    model: response?.model || "unknown",
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
  },
}];
```

## Node 2 — `Cost: Compute Run Cost` (Code node)

```javascript
// Cost: Compute Run Cost
// Applies current per-token pricing to the usage extracted above.
//
// IMPORTANT: fill in PRICING from the live pricing page before relying on
// this — https://docs.claude.com/en/docs/about-claude/pricing — rates differ
// by model and change over time, and hardcoding a stale number here would
// quietly make every future cost figure wrong. Values below are placeholders
// (per million tokens, USD) — replace with the current published rate for
// whichever model the synthesis + judge calls actually use.

const PRICING = {
  // model_name: { inputPerMTok, outputPerMTok, cacheWritePerMTok, cacheReadPerMTok }
  "claude-sonnet-4-5": { inputPerMTok: 3.00, outputPerMTok: 15.00, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.30 },
  "claude-haiku-4-5": { inputPerMTok: 1.00, outputPerMTok: 5.00, cacheWritePerMTok: 1.25, cacheReadPerMTok: 0.10 },
  // add/adjust entries to match exactly what's live on the pricing page
};

const usage = $json;
const modelKey = Object.keys(PRICING).find((k) => (usage.model || "").includes(k)) || null;
const rates = modelKey ? PRICING[modelKey] : null;

let costUsd = null;
if (rates) {
  costUsd =
    (usage.input_tokens / 1_000_000) * rates.inputPerMTok +
    (usage.output_tokens / 1_000_000) * rates.outputPerMTok +
    (usage.cache_creation_input_tokens / 1_000_000) * rates.cacheWritePerMTok +
    (usage.cache_read_input_tokens / 1_000_000) * rates.cacheReadPerMTok;
  costUsd = Math.round(costUsd * 10000) / 10000; // 4 d.p. — daily runs are small $ amounts
}

return [{
  json: {
    ...usage,
    cost_usd: costUsd,
    pricing_matched: Boolean(rates),
    computed_at: new Date().toISOString(),
  },
}];
```

## Node 3 — `Cost: Log Run` (Code node → the existing `job_runs` table)

Same principle as [EVALUATION.md](./EVALUATION.md#node-6--eval-log-result-code-node--the-existing-job_runs-table): don't build a second logging system when `job_runs` and the Agent Status page already exist. This writes a `"cost"` job row through the same `n8n.logJobRun` endpoint proposed there.

```javascript
// Cost: Log Run
// Flattens the run's cost record into the job_runs logging shape.

const brief = $node["Claude — Synthesis"].json; // for date/dateSlug context
const cost = $json;

return [{
  json: {
    job: "cost",
    status: cost.pricing_matched ? "ok" : "error", // "error" = cost unknown, pricing table needs updating
    startedAt: Date.now(),
    summary: {
      dateSlug: brief.dateSlug ?? null,
      model: cost.model,
      inputTokens: cost.input_tokens,
      outputTokens: cost.output_tokens,
      cacheReadTokens: cost.cache_read_input_tokens,
      costUsd: cost.cost_usd,
    },
  },
}];
```

Point this at the same `POST /api/trpc/n8n.logJobRun` (`X-Api-Key` header) that Node 6 in EVALUATION.md uses — one endpoint, one table, two new job types (`eval`, `cost`) alongside the four that already exist.

## Turning the log into unit economics

Once a few weeks of runs are logged, three numbers become answerable with a query instead of a guess:

- **Cost per brief** = average `cost_usd` across runs (Claude API only; add the eval judge call's cost the same way if it's kept live per EVALUATION.md)
- **Fully-loaded monthly cost** = $6 (droplet) + sum of the month's `cost_usd` + any Tavily/Render/Neon spend once past free tier
- **Cost per subscriber** = fully-loaded monthly cost ÷ subscriber count (currently 55)

That last number is the one worth leading with in an interview: it reframes the project from "I built an AI newsletter" to "I can tell you exactly what it costs to serve one more subscriber, and what breaks that unit economics at 10x the volume" — which is the actual question an enterprise AI-platform team has to answer before greenlighting anything.

## What changes at enterprise scale

At 55 free subscribers, a few dollars a month is a rounding error and this document is mostly a discipline exercise. The things that would actually matter at enterprise volume, worth naming explicitly rather than pretending this setup already handles them:

- **Batching and caching** — prompt caching on the (largely static) system instructions and schema definition would cut input-token cost meaningfully at higher run frequency; not yet implemented here because one run/day doesn't justify the added complexity.
- **Per-tenant or per-workflow cost attribution** — fine at n=1 workflow; needs a `workflow_id`/`tenant_id` dimension on every log row the moment there's more than one pipeline sharing the same API budget.
- **Budget alerts, not just logs** — a log you check is monitoring; a threshold that pages someone before the month-end bill is a surprise is cost *management*. Worth adding once spend is non-trivial.
