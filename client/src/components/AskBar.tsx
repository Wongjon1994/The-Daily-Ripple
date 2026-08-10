/**
 * Ask bar (Agentic Ripple) — the agentic entry point at the top of Signals.
 *
 * Answer-led, one action: a single deliberate "Ask" runs a grounded synthesis
 * (`n8n.synthesizeAnswer`, Haiku) and lands straight on the answer — the LLM cost
 * is still only paid on explicit intent (one submit), not on every keystroke.
 * The call returns the answer AND its citations, so no separate retrieval pass is
 * needed; the cited briefs sit in a collapsed "Sources" disclosure beneath the
 * answer rather than a dominating grid. Inline [n] chips preview the source on
 * hover and open the brief on click.
 *
 * Degrades gracefully: no embeddings (OPENAI_API_KEY) → no citations; no
 * ANTHROPIC_API_KEY → answer empty but the cited briefs still show.
 */

import { useState, type ReactNode } from "react";
import { Sparkles, Loader2, ArrowRight, ArrowUpRight, X, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Hit = {
  type: "signal" | "brief";
  text: string;
  briefSlug: string;
  theme?: string;
  category?: string;
  score: number;
};

const EXAMPLES = ["Where are oil prices headed?", "The read on US rates", "China risk this quarter"];

/** Strip Haiku's light markdown and turn inline [n] refs into citation chips
 *  that preview the source on hover and link to the cited brief on click. */
function renderAnswer(answer: string, citations: Hit[]): ReactNode {
  const clean = answer.replace(/^#{1,6}\s*/gm, "").replace(/\*\*(.+?)\*\*/g, "$1");
  return clean
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((para, pi) => (
      <p key={pi} className="leading-relaxed" style={{ color: "var(--color-mist)", fontSize: 14 }}>
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
                  className="inline-flex items-center align-super font-mono rounded px-1 mx-0.5 transition-colors hover:brightness-125"
                  style={{ fontSize: 9, color: "var(--color-cyan)", background: "color-mix(in oklab, var(--color-cyan) 16%, transparent)" }}
                  title={`${cite.type === "signal" ? cite.theme ?? "signal" : cite.category ?? "brief"} — ${cite.text}`}
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

function SourceRow({ hit, n }: { hit: Hit; n: number }) {
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

/** Cited briefs, collapsed by default beneath the answer. */
function Sources({ citations, defaultOpen }: { citations: Hit[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (citations.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono font-semibold uppercase px-1 py-1 transition-colors hover:text-[var(--color-mist-dim)]"
        style={{ color: "var(--color-mist-faint)", fontSize: 10, letterSpacing: "0.08em" }}
      >
        Sources · {citations.length}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
          {citations.map((h, i) => <SourceRow key={i} hit={h} n={i + 1} />)}
        </div>
      )}
    </div>
  );
}

export default function AskBar() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const synth = trpc.n8n.synthesizeAnswer.useMutation();

  const answer = synth.data?.answer ?? "";
  const citations = (synth.data?.citations ?? []) as Hit[];

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setDraft(trimmed);
    setQuery(trimmed);
    synth.mutate({ q: trimmed });
  };

  const reset = () => {
    setDraft("");
    setQuery("");
    synth.reset();
  };

  const asked = query.length > 0;

  return (
    <section aria-label="Ask the Ripple">
      {/* Ask pill — sparkle mark, question input, circular submit (Ripple style) */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        className="flex items-center gap-2.5 rounded-full border pl-4 pr-1.5 py-1.5"
        style={{
          borderColor: "var(--card-lift-border)",
          background: "color-mix(in oklab, var(--color-cyan) 4%, var(--card))",
          boxShadow: "inset 0 1px 0 0 var(--card-lift-edge)",
        }}
      >
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--color-cyan)" }} />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Ripple across the briefs…"
          maxLength={400}
          className="flex-1 bg-transparent outline-none text-sm min-w-0 py-1"
          style={{ color: "var(--color-mist)" }}
        />
        {asked && (
          <button type="button" onClick={reset} aria-label="Clear" className="shrink-0 p-1 rounded-full transition-colors hover:text-[var(--color-mist)]" style={{ color: "var(--color-mist-faint)" }}>
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={!draft.trim() || synth.isPending}
          aria-label="Ask"
          className="shrink-0 grid place-items-center h-9 w-9 rounded-full transition-colors disabled:opacity-40"
          style={{ color: "var(--background)", background: "var(--color-cyan)" }}
        >
          {synth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {!asked && (
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap px-1">
          <span className="font-mono uppercase tracking-[0.1em]" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>Try</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="rounded-full border border-border/60 px-2.5 py-0.5 text-[11px] transition-colors hover:border-[var(--color-cyan-dim)] hover:text-[var(--color-cyan)]"
              style={{ color: "var(--color-mist-faint)" }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Result — answer first, sources collapsed beneath */}
      {asked && (
        <div className="mt-3 space-y-3">
          {synth.isPending ? (
            <div className="flex items-center gap-2 px-1 py-2 text-sm" style={{ color: "var(--color-mist-faint)" }}>
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-cyan-dim)" }} /> Reading across the briefs…
            </div>
          ) : synth.isError ? (
            <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
              <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>Couldn't reach the synthesis service.</p>
              <button onClick={() => ask(query)} className="text-xs mt-2 font-mono" style={{ color: "var(--color-cyan)" }}>Try again</button>
            </div>
          ) : citations.length === 0 && !answer ? (
            <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
              <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>No matching briefs yet.</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-mist-faint)" }}>
                Semantic search builds as briefs are embedded — try a broader question.
              </p>
            </div>
          ) : (
            <>
              {answer ? (
                <div
                  className="rounded-xl border p-4"
                  style={{ borderColor: "color-mix(in oklab, var(--color-cyan) 30%, transparent)", background: "color-mix(in oklab, var(--color-cyan) 5%, var(--card))" }}
                >
                  <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-2.5" style={{ color: "var(--color-cyan)", fontSize: 10, letterSpacing: "0.08em" }}>
                    <Sparkles className="h-3.5 w-3.5" /> Ripple's read
                  </div>
                  <div className="space-y-2.5">{renderAnswer(answer, citations)}</div>
                </div>
              ) : (
                <p className="text-xs px-1" style={{ color: "var(--color-mist-faint)" }}>
                  Answer unavailable right now — here are the most relevant briefs.
                </p>
              )}

              <Sources citations={citations} defaultOpen={!answer} />
            </>
          )}
        </div>
      )}
    </section>
  );
}
