# Evaluation layer

**Status: proposed design, not yet running in production.** This is the layer I'd build first if I were starting over — see the README's "what I'd do differently." Structural validation exists today (Zod, reject malformed output) and, separately, the app already has a background-agent monitoring pattern — a `job_runs` table and an Agent Status page tracking four scheduled jobs (`signal`, `realise`, `synthesis`, `alpha` — see [ARCHITECTURE.md](./ARCHITECTURE.md#the-signals-subsystem--agentic-ripple)). Neither of those catches output that is *well-formed but wrong*, which is the failure mode that actually bit the project (the S&P 500 / Nikkei 225 hallucination incident below). This document proposes closing that gap by adding two new job types — `eval` and `cost` (this doc's counterpart, [COST_TRACKING.md](./COST_TRACKING.md)) — to the *same* `job_runs` table and Agent Status page, rather than building a second, disconnected observability system next to one that already works.

## Why schema validation isn't enough

The existing pipeline validates that a brief is *structurally* correct — the right fields, the right types, the right lengths. It does not validate that a brief is *factually* correct. The one concrete failure the project has had came from exactly this gap: the model reported S&P 500 and Nikkei 225 index levels that were off by roughly 25–45% from the real values on two separate days. The numbers were well-formed (`"value": "5,560"` — completely valid per the schema, completely wrong as a fact). Zod cannot catch that; it needs a different kind of check.

## Framework: three checks, one score, one log

| Check | Catches | Method | Gate type |
|---|---|---|---|
| **Schema conformance** | Malformed structure, missing fields | Zod (already live) | Hard gate — already blocks publish |
| **Numeric sanity** | Hallucinated figures on tracked metrics (the S&P/Nikkei bug) | Day-over-day delta check against the last published brief | Soft gate — flags + alerts, doesn't block (see below) |
| **LLM-as-judge rubric** | Weak sourcing, thin Singapore Lens, generic analysis, tone drift | A second, cheaper Claude call scores the brief 1–5 on 4 dimensions | Soft gate — logged, reviewed weekly |

**Why soft-gate the new checks initially, not hard-gate:** this is a single-operator system publishing once a day — a false positive that blocks publish means subscribers get nothing that day, which is worse than a flagged-but-published brief I can review each morning. Once the numeric-sanity check has a few weeks of track record with zero false positives, it's worth promoting to a hard gate specifically for tracked-index metrics (the class of error that already happened once).

## Where this sits in the pipeline

Insert both eval nodes **after** the Tools Agent (synthesis) node and **before** the existing `Check Brief Validity` gate, so validation still runs last before publish. *(These nodes assume the structured `DailyBrief` object is in hand inside n8n — i.e. the direct-JSON pipeline described as the target in [ARCHITECTURE.md](./ARCHITECTURE.md#the-publish-pipeline--how-it-works-today-and-where-its-headed). On today's live Telegraph pipeline the agent emits HTML and the structured object only exists after the server's reparse, so until direct-JSON ships these checks would run server-side / post-reparse instead.)*

```
Claude — Synthesis
      ↓
Eval: Numeric Sanity Check  ──┐
      ↓                        ├─→ Eval: Log Result ──→ POST /api/trpc/n8n.logJobRun (job: "eval")
Eval: LLM-as-Judge Score  ────┘                          → same job_runs table + Agent Status page
      ↓                                                     as signal / realise / synthesis / alpha
Check Brief Validity (existing)
      ↓
Publish (Telegraph today; direct /api/publish once migrated)
```

## Node 1 — `Eval: Fetch Previous Brief` (HTTP Request node)

No code — configure an HTTP Request node before the sanity check:

- **Method**: GET
- **URL**: `https://the-daily-ripple.onrender.com/api/n8n-brief`
- **Response Format**: JSON

This returns the most recently published brief, which the sanity check compares against.

## Node 2 — `Eval: Numeric Sanity Check` (Code node)

Paste this into a new **Code** node immediately after `Eval: Fetch Previous Brief`, connected from the synthesis output:

```javascript
// Eval: Numeric Sanity Check
// Flags implausible day-over-day moves in tracked metrics — the exact class of
// bug that produced the S&P 500 / Nikkei 225 hallucination (25-45% off, both
// well-formed and wrong per the schema).

const draft = $node["Claude — Synthesis"].json; // today's freshly generated DailyBrief
const previous = $node["Eval: Fetch Previous Brief"].json?.brief ?? null;

// Tracked metrics and the max plausible day-over-day % move before we flag it.
// These thresholds are deliberately generous — the goal is to catch
// hallucinations (wrong by tens of percent), not normal volatility.
const TRACKED_METRICS = {
  "S&P 500": 8,
  "Nikkei 225": 8,
  "STI": 8,
  "Hang Seng": 10,
  "Brent": 15,
  "WTI": 15,
  "US 10-Year Treasury Yield": 15,
  "10-Year Yield": 15,
};

function normalizeLabel(label) {
  return (label || "").trim().toLowerCase();
}

function parseNumeric(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Build a lookup of yesterday's metric values by normalized label
const previousMetrics = {};
if (previous?.sections) {
  for (const section of previous.sections) {
    for (const metric of section.keyMetrics || []) {
      previousMetrics[normalizeLabel(metric.label)] = parseNumeric(metric.value);
    }
  }
}

const flags = [];
let checkedCount = 0;

for (const section of draft.sections || []) {
  for (const metric of section.keyMetrics || []) {
    const label = normalizeLabel(metric.label);
    const trackedEntry = Object.entries(TRACKED_METRICS).find(
      ([trackedLabel]) => label.includes(trackedLabel.toLowerCase())
    );
    if (!trackedEntry) continue;

    const [trackedLabel, maxPctMove] = trackedEntry;
    const todayValue = parseNumeric(metric.value);
    const yesterdayValue = previousMetrics[label];

    checkedCount++;

    if (todayValue === null) {
      flags.push({
        metric: trackedLabel,
        issue: "unparseable_value",
        value: metric.value,
      });
      continue;
    }

    if (yesterdayValue === null || yesterdayValue === 0) continue; // no baseline yet

    const pctMove = Math.abs((todayValue - yesterdayValue) / yesterdayValue) * 100;
    if (pctMove > maxPctMove) {
      flags.push({
        metric: trackedLabel,
        issue: "implausible_move",
        yesterdayValue,
        todayValue,
        pctMove: Math.round(pctMove * 10) / 10,
        maxAllowed: maxPctMove,
      });
    }
  }
}

return [{
  json: {
    ...draft,
    _eval: {
      numericSanity: {
        checkedCount,
        flagCount: flags.length,
        flags,
        passed: flags.length === 0,
      },
    },
  },
}];
```

## Node 3 — `Eval: LLM-as-Judge Score` (HTTP Request node → Anthropic Messages API)

Configure an HTTP Request node calling Claude directly as a judge (cheap model — Haiku-class is enough for a rubric score; no need to spend a Sonnet/Opus-tier call scoring a Sonnet/Opus-tier call):

- **Method**: POST
- **URL**: `https://api.anthropic.com/v1/messages`
- **Headers**: `x-api-key: {{ $credentials.anthropicApi.apiKey }}`, `anthropic-version: 2023-06-01`, `Content-Type: application/json`
- **Body** (JSON, Expression mode):

```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 500,
  "messages": [
    {
      "role": "user",
      "content": "You are a strict editorial quality judge for a daily geopolitical/markets/tech briefing written for a Singapore-based reader. Score the brief below on 4 dimensions, 1-5 each (5 = excellent). Respond with ONLY valid JSON, no prose.\n\nDimensions:\n- sourcing: are claims attributed to identifiable, real-sounding sources (not vague like 'reports suggest')?\n- singapore_lens_relevance: is each section's Singapore Lens specific and non-generic, not a copy-paste framing that could apply to any country?\n- analytical_depth: does the analysis go beyond restating the headline?\n- internal_consistency: do the numbers, dates, and claims agree with each other within the brief?\n\nRespond with exactly this JSON shape:\n{\"sourcing\": <1-5>, \"singapore_lens_relevance\": <1-5>, \"analytical_depth\": <1-5>, \"internal_consistency\": <1-5>, \"lowest_dimension_reason\": \"<one sentence on the weakest dimension>\"}\n\nBrief to score:\n{{ JSON.stringify($json) }}"
    }
  ]
}
```

## Node 4 — `Eval: Parse Judge Score` (Code node)

```javascript
// Eval: Parse Judge Score
// Parses the judge model's JSON response, computes a composite score, and
// merges it into the brief's running _eval object.

const draft = $node["Eval: Numeric Sanity Check"].json;
const judgeRaw = $input.item.json;

let judgeScore = null;
let parseError = null;

try {
  const text = judgeRaw?.content?.[0]?.text ?? "{}";
  judgeScore = JSON.parse(text);
} catch (err) {
  parseError = String(err);
}

const dims = ["sourcing", "singapore_lens_relevance", "analytical_depth", "internal_consistency"];
let composite = null;

if (judgeScore && dims.every((d) => typeof judgeScore[d] === "number")) {
  composite = Math.round(
    (dims.reduce((sum, d) => sum + judgeScore[d], 0) / dims.length) * 10
  ) / 10;
}

// Threshold: below 3.0/5 composite triggers a review alert (soft gate).
const REVIEW_THRESHOLD = 3.0;

return [{
  json: {
    ...draft,
    _eval: {
      ...draft._eval,
      judge: {
        scores: judgeScore,
        composite,
        parseError,
        needsReview: composite !== null ? composite < REVIEW_THRESHOLD : true,
      },
    },
  },
}];
```

## Node 5 — `Eval: Route + Alert` (If node + Telegram node)

Add an **If** node after `Eval: Parse Judge Score` with condition:

```
{{ $json._eval.numericSanity.passed === false || $json._eval.judge.needsReview === true }}
equals
true
```

**True branch** → a Telegram node, `Notify: Eval Flag`, message:

```
⚠️ Brief flagged for review — {{ $json.date }}
Numeric sanity: {{ $json._eval.numericSanity.passed ? "pass" : $json._eval.numericSanity.flagCount + " flag(s)" }}
Judge composite: {{ $json._eval.judge.composite }}/5 ({{ $json._eval.judge.scores?.lowest_dimension_reason }})
Publishing continues — review before next run.
```

**Both branches** continue to the existing `Validate Brief Schema` → publish flow unchanged. This is a soft gate: it alerts, it doesn't block.

## Node 6 — `Eval: Log Result` (Code node → the existing `job_runs` table)

The app already has exactly the table this belongs in: `job_runs` (`job`, `status`, `started_at`, `finished_at`, `summary` jsonb), written by the `signal` / `realise` / `synthesis` / `alpha` background jobs and read by the existing Agent Status page (`getAgentStatus`, see [ARCHITECTURE.md](./ARCHITECTURE.md#the-signals-subsystem--agentic-ripple)). Logging eval results as a fifth job type means they show up on that same status page for free, instead of living in a spreadsheet nobody opens.

```javascript
// Eval: Log Result
// Flattens the eval record into the shape the job_runs logging endpoint
// expects: { job, status, startedAt, summary }.

const brief = $json;
const evalData = brief._eval || {};
const passed = (evalData.numericSanity?.passed ?? true) && !(evalData.judge?.needsReview);

return [{
  json: {
    job: "eval",
    status: passed ? "ok" : "error", // "error" here means "flagged for review", not a crash
    startedAt: Date.now(), // set from the workflow's actual start time if you have it
    summary: {
      dateSlug: brief.dateSlug,
      schemaConformancePass: true, // set false upstream if Validate Brief Schema rejected it
      numericSanityPass: evalData.numericSanity?.passed ?? null,
      numericFlagsCount: evalData.numericSanity?.flagCount ?? null,
      judgeScores: evalData.judge?.scores ?? null,
      judgeComposite: evalData.judge?.composite ?? null,
      needsReview: evalData.judge?.needsReview ?? null,
    },
  },
}];
```

Feed this into an HTTP Request node POSTing to the small logging endpoint below.

## The one backend addition this needs: expose `recordJobRun` over the API

`recordJobRun(job, status, startedAt, summary)` already exists in `server/db.ts` — it's what the four existing agents call. It just isn't reachable from outside the server process yet. Add one admin-key-protected mutation that wraps it, mirroring the existing `n8n.publish` pattern:

```typescript
// server/routers.ts — add alongside the existing n8n.publish procedure
logJobRun: apiKeyProcedure
  .input(z.object({
    job: z.enum(["signal", "realise", "synthesis", "alpha", "eval", "cost"]),
    status: z.enum(["ok", "error"]),
    startedAt: z.number().nullable(),
    summary: z.record(z.any()).default({}),
  }))
  .mutation(async ({ input }) => {
    await recordJobRun(input.job, input.status, input.startedAt, input.summary);
    return { ok: true };
  }),
```

(Import `recordJobRun` from `./db.js` alongside the other `db` imports already at the top of `routers.ts`.) Point n8n's HTTP Request node at `POST /api/trpc/n8n.logJobRun` with an `X-Api-Key` header, same as the existing publish call — no new table, no new auth pattern, and the eval result appears on the same Agent Status page as the other four jobs the moment it lands.

This gets you a queryable trend line on brief quality over time — e.g. "eval job pass rate, 30-day rolling average" — straight out of infrastructure that already exists, which is the kind of thing that turns "I evaluate output quality" from a claim into a screenshot in an interview.

## What this is not

This is not a full offline eval suite with a labeled golden dataset and regression testing — that's the natural next step if this were a team product rather than a single-operator daily brief, and it's worth naming explicitly as the difference between "evaluation for a solo project" and "evaluation for a production enterprise system": the latter needs versioned prompts, a held-out test set, and CI-gated regression checks before a prompt change ships, not just a per-run judge score.
