/**
 * Ask bar (Agentic Ripple, Phase D) — the agentic entry point at the top of the
 * Signals page. Retrieval-first: a query runs free semantic search over the signal
 * ledger + brief chunks (`n8n.search`). "Synthesize" is opt-in and calls Haiku
 * (`n8n.synthesizeAnswer`) for a grounded, cited answer — so generation cost is
 * only paid on explicit intent, per the locked cost model.
 *
 * Degrades gracefully: with no embeddings (OPENAI_API_KEY unset) search returns
 * nothing; with no ANTHROPIC_API_KEY the answer is empty but citations still show.
 */

import { useState, type ReactNode } from "react";
import { Search, Sparkles, Loader2, ArrowUpRight, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

type Hit = {
  type: "signal" | "brief";
  text: string;
  briefSlug: string;
  theme?: string;
  category?: string;
  score: number;
};

const EXAMPLES = ["Where are oil prices headed?", "The read on US rates", "China risk this quarter"];

/** Strip Haiku's light markdown (headers, bold) and turn inline [n] refs into
 *  citation chips that link to the cited brief. */
function renderAnswer(answer: string, citations: Hit[]): ReactNode {
  const clean = answer.replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1");
  return clean
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para, pi) => (
      <p key={pi} className="leading-relaxed" style={{ color: "var(--color-mist-dim)", fontSize: 14 }}>
        {para.split(/(\[\d+\])/g).map((part, i) => {
          const m = part.match(/^\[(\d+)\]$/);
          if (m) {
            const n = parseInt(m[1], 10);
            const cite = citations[n - 1];
            if (cite)
              return (
                <Link
                  key={i}
                  href={`/brief/${cite.briefSlug}`}
                  className="inline-flex items-center align-super font-mono rounded px-1 mx-0.5 transition-colors"
                  style={{ fontSize: 9, color: "var(--color-cyan)", background: "color-mix(in oklab, var(--color-cyan) 14%, transparent)" }}
                  title={cite.text}
                >
                  {n}
                </Link>
              );
          }
          return <span key={i}>{part}</span>;
        })}
      </p>
    ));
}

function HitRow({ hit, n }: { hit: Hit; n: number }) {
  const tag = hit.type === "signal" ? hit.theme : hit.category;
  return (
    <Link
      href={`/brief/${hit.briefSlug}`}
      className="block rounded-md border border-border/50 bg-[var(--color-ink-well)] p-2.5 transition-colors hover:border-[color-mix(in_oklab,var(--color-cyan)_45%,transparent)]"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono" style={{ color: "var(--color-cyan)", fontSize: 10 }}>[{n}]</span>
        <span className="font-mono uppercase tracking-[0.08em]" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>
          {hit.type}{tag ? ` · ${tag}` : ""}
        </span>
        <span className="font-mono ml-auto" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>
          {Math.round(hit.score * 100)}% match
        </span>
      </div>
      <p className="leading-snug flex items-start gap-1" style={{ color: "var(--color-mist-dim)", fontSize: 12 }}>
        <span className="line-clamp-2">{hit.text}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 mt-0.5" style={{ color: "var(--color-mist-faint)" }} />
      </p>
    </Link>
  );
}

export default function AskBar() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");

  const search = trpc.n8n.search.useQuery({ q: query, k: 8 }, { enabled: query.length > 0 });
  const synth = trpc.n8n.synthesizeAnswer.useMutation();

  const hits = (search.data?.hits ?? []) as Hit[];
  const answer = synth.data?.answer ?? "";
  const citations = (synth.data?.citations ?? []) as Hit[];

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setDraft(trimmed);
    setQuery(trimmed);
    synth.reset();
  };

  const reset = () => {
    setDraft("");
    setQuery("");
    synth.reset();
  };

  return (
    <section aria-label="Ask the Ripple">
      <div
        className="rounded-xl border p-3 sm:p-4"
        style={{
          borderColor: "var(--card-lift-border)",
          background: "color-mix(in oklab, var(--color-cyan) 4%, var(--card))",
          boxShadow: "inset 0 1px 0 0 var(--card-lift-edge)",
        }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); submit(draft); }}
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-cyan)" }} />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask across the briefs — “where are oil prices headed?”"
            maxLength={400}
            className="flex-1 bg-transparent outline-none text-sm min-w-0"
            style={{ color: "var(--color-mist)" }}
          />
          {query && (
            <button type="button" onClick={reset} aria-label="Clear" className="shrink-0 p-1 rounded transition-colors hover:text-[var(--color-mist)]" style={{ color: "var(--color-mist-faint)" }}>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors disabled:opacity-40"
            style={{ color: "var(--color-cyan)", border: "1px solid var(--color-cyan-dim)", background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)" }}
          >
            Search
          </button>
        </form>

        {!query && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span className="font-mono uppercase tracking-[0.1em]" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => submit(ex)}
                className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] transition-colors hover:border-[var(--color-cyan-dim)] hover:text-[var(--color-cyan)]"
                style={{ color: "var(--color-mist-faint)" }}
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {query && (
        <div className="mt-3 space-y-3">
          {search.isLoading ? (
            <div className="flex items-center gap-2 px-1 py-2 text-sm" style={{ color: "var(--color-mist-faint)" }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-cyan-dim)" }} /> Searching the ledger…
            </div>
          ) : hits.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
              <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>No matching signals yet.</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-mist-faint)" }}>
                Semantic search builds as briefs are embedded — try a broader question.
              </p>
            </div>
          ) : (
            <>
              {/* Synthesize action / answer */}
              {answer ? (
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "color-mix(in oklab, var(--color-cyan) 30%, transparent)", background: "color-mix(in oklab, var(--color-cyan) 5%, var(--card))" }}
                >
                  <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-2" style={{ color: "var(--color-cyan)", fontSize: 10, letterSpacing: "0.08em" }}>
                    <Sparkles className="h-3.5 w-3.5" /> Synthesised answer
                  </div>
                  <div className="space-y-2.5">{renderAnswer(answer, citations)}</div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                  <p className="text-xs" style={{ color: "var(--color-mist-dim)" }}>
                    {synth.isSuccess
                      ? "Couldn’t synthesise an answer from the current context — see the sources below."
                      : `${hits.length} sources found. Synthesise a grounded, cited answer?`}
                  </p>
                  <button
                    onClick={() => synth.mutate({ q: query })}
                    disabled={synth.isPending}
                    className="shrink-0 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors disabled:opacity-50"
                    style={{ color: "var(--color-cyan)", border: "1px solid var(--color-cyan-dim)", background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)" }}
                  >
                    {synth.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    {synth.isPending ? "Synthesising…" : "Synthesise"}
                  </button>
                </div>
              )}

              {/* Sources */}
              <div>
                <div className="font-mono font-semibold uppercase mb-2 px-1" style={{ color: "var(--color-mist-faint)", fontSize: 10, letterSpacing: "0.08em" }}>
                  Sources · {hits.length}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {hits.map((h, i) => <HitRow key={i} hit={h} n={i + 1} />)}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
