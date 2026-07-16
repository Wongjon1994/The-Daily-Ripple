/**
 * Editorial review queue (Agentic Ripple, Phase D). Admin-only page for the
 * signals the realisation sweep scored in the ambiguous band (pending_review):
 * confirm one as realised, or dismiss it back to open. The confirm/dismiss
 * mutations are apiKeyProcedure (PUBLISH_API_KEY); the admin pastes that key once
 * and it's held in sessionStorage (sent as x-api-key by the tRPC client), never
 * persisted to disk. Not linked in the nav.
 */

import { useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, XCircle, KeyRound, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc, ADMIN_KEY_STORAGE } from "@/lib/trpc";
import MastheadBanner from "@/components/MastheadBanner";

const THEME_TAG: Record<string, { label: string; color: string }> = {
  geopolitics: { label: "Geopolitics", color: "var(--color-cat-geopolitics)" },
  ai_tech: { label: "AI & Tech", color: "var(--color-cyan)" },
  health: { label: "Health", color: "var(--color-sage)" },
  society: { label: "Society", color: "var(--color-cat-culture)" },
  rates: { label: "Rates", color: "var(--color-cat-tech)" },
  markets: { label: "Markets", color: "var(--color-cat-science)" },
  energy: { label: "Energy", color: "var(--color-cat-economics)" },
  other: { label: "Signal", color: "var(--color-mist-faint)" },
};
const tag = (theme: string) => THEME_TAG[theme] ?? THEME_TAG.other;

function KeyBar({ hasKey, onSave, onClear }: { hasKey: boolean; onSave: (k: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-2 flex-wrap">
      <KeyRound className="h-4 w-4 shrink-0" style={{ color: hasKey ? "var(--color-sage)" : "var(--color-gold-rich)" }} />
      {hasKey ? (
        <>
          <span className="text-sm flex items-center gap-1.5" style={{ color: "var(--color-mist-dim)" }}>
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--color-sage)" }} /> Admin key set for this session
          </span>
          <button onClick={onClear} className="ml-auto text-xs font-mono transition-colors hover:text-[var(--color-crimson)]" style={{ color: "var(--color-mist-faint)" }}>
            Clear key
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); if (draft.trim()) { onSave(draft.trim()); setDraft(""); } }}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste PUBLISH_API_KEY to enable confirm / dismiss"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm"
            style={{ color: "var(--color-mist)" }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors disabled:opacity-40"
            style={{ color: "var(--color-cyan)", border: "1px solid var(--color-cyan-dim)", background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)" }}
          >
            Unlock
          </button>
        </form>
      )}
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortIso = (s?: string | null) => {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}` : s;
};

export default function AdminSignalsPage() {
  const [hasKey, setHasKey] = useState(
    () => typeof sessionStorage !== "undefined" && !!sessionStorage.getItem(ADMIN_KEY_STORAGE)
  );

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.n8n.getSignals.useQuery({ status: "pending_review" });
  const pending = (data?.signals ?? []) as any[];

  const onSettled = () => utils.n8n.getSignals.invalidate();
  const onError = (e: { message: string }) =>
    toast.error(/unauthor/i.test(e.message) ? "Invalid admin key — re-enter it above." : e.message);

  const confirm = trpc.n8n.confirmSignal.useMutation({ onSuccess: () => toast.success("Confirmed as realised"), onError, onSettled });
  const dismiss = trpc.n8n.dismissSignal.useMutation({ onSuccess: () => toast.success("Dismissed to open"), onError, onSettled });
  const busyId = confirm.isPending ? confirm.variables?.id : dismiss.isPending ? dismiss.variables?.id : undefined;

  return (
    <div className="min-h-screen">
      <MastheadBanner />
      <main className="container py-8 max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}>
            Editorial review
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--color-mist-faint)" }}>
            Signals the realisation sweep flagged for a human call. Confirm to mark realised, or dismiss back to open.
          </p>
        </div>

        <KeyBar
          hasKey={hasKey}
          onSave={(k) => { sessionStorage.setItem(ADMIN_KEY_STORAGE, k); setHasKey(true); }}
          onClear={() => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); setHasKey(false); }}
        />

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm" style={{ color: "var(--color-mist-faint)" }}>
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-cyan-dim)" }} /> Loading queue…
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-3" style={{ color: "var(--color-sage)" }} />
            <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>The queue is clear.</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-mist-faint)" }}>No signals are pending review right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((s) => {
              const t = tag(s.theme);
              const busy = busyId === s.id;
              return (
                <div key={s.id} className="rounded-xl border border-border/60 bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono uppercase tracking-[0.06em] rounded px-1.5 py-0.5" style={{ color: t.color, background: `color-mix(in oklab, ${t.color} 12%, transparent)`, fontSize: 9 }}>
                      {t.label}
                    </span>
                    {typeof s.confidence === "number" && (
                      <span className="font-mono" style={{ color: "var(--color-gold-rich)", fontSize: 10 }}>conf {s.confidence.toFixed(2)}</span>
                    )}
                    <Link href={`/brief/${s.briefDateSlug}?story=${s.storyIndex + 1}`} className="font-mono ml-auto transition-colors hover:text-[var(--color-cyan)]" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>
                      surfaced {shortIso(s.surfacedDate)}
                    </Link>
                  </div>

                  <p className="leading-relaxed mb-2" style={{ color: "var(--color-mist)", fontSize: 14 }}>{s.signalText}</p>

                  {(s.realisedEvidenceNote || s.realisedEvidenceUrl) && (
                    <div className="rounded-md border border-border/50 bg-[var(--color-ink-well)] p-2.5 mb-3">
                      <div className="font-mono font-semibold uppercase mb-1" style={{ color: "var(--color-mist-faint)", fontSize: 9, letterSpacing: "0.08em" }}>
                        Sweep evidence{s.lastCheckedDate ? ` · checked ${shortIso(s.lastCheckedDate)}` : ""}
                      </div>
                      {s.realisedEvidenceNote && <p className="leading-snug" style={{ color: "var(--color-mist-dim)", fontSize: 12 }}>{s.realisedEvidenceNote}</p>}
                      {s.realisedEvidenceUrl && (
                        <a href={s.realisedEvidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 font-mono transition-colors hover:text-[var(--color-cyan)]" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>
                          {s.realisedEvidenceUrl.replace(/^https?:\/\//, "").slice(0, 48)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirm.mutate({ id: s.id })}
                      disabled={!hasKey || busy}
                      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors disabled:opacity-40"
                      style={{ color: "var(--color-sage)", border: "1px solid color-mix(in oklab, var(--color-sage) 40%, transparent)", background: "color-mix(in oklab, var(--color-sage) 10%, transparent)" }}
                    >
                      {busy && confirm.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Confirm realised
                    </button>
                    <button
                      onClick={() => dismiss.mutate({ id: s.id })}
                      disabled={!hasKey || busy}
                      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-mono transition-colors disabled:opacity-40"
                      style={{ color: "var(--color-crimson)", border: "1px solid color-mix(in oklab, var(--color-crimson) 40%, transparent)", background: "color-mix(in oklab, var(--color-crimson) 8%, transparent)" }}
                    >
                      {busy && dismiss.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      Dismiss
                    </button>
                    {!hasKey && <span className="text-[11px]" style={{ color: "var(--color-mist-faint)" }}>Unlock with the admin key to act</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
