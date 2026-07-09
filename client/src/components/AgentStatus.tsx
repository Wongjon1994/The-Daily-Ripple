/**
 * Agent Status (Agentic Ripple, Phase D). A compact monitor for the background
 * jobs that produce the intelligence layer: the latest run per job (Signal
 * extraction, Synthesis, Realisation sweep) with a health/status dot and a
 * data-health footer (briefs, ledger counts, embedded chunks). Reads the
 * existing `n8n.getAgentStatus` (Phase B); render-only, degrades gracefully.
 *
 * Note: pg returns bigint `finished_at` as a STRING — coerce with Number().
 */

import { Activity, CircleCheck, CircleAlert, CircleDashed } from "lucide-react";
import { trpc } from "@/lib/trpc";

const JOB_META: Record<string, { label: string }> = {
  signal: { label: "Signal extraction" },
  synthesis: { label: "Synthesis" },
  alpha: { label: "House view" },
  realise: { label: "Realisation sweep" },
};
const JOB_ORDER = ["signal", "synthesis", "alpha", "realise"];

type Agent = { job: string; status: string; started_at: unknown; finished_at: unknown; summary: unknown };

/** "just now" / "3h ago" / "2d ago" from an epoch-ms value (string or number). */
function ago(ms: unknown): string {
  const t = Number(ms);
  if (!Number.isFinite(t) || t <= 0) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Compact "key val · key val" from a job's summary jsonb (scalar entries only). */
function summarise(summary: unknown): string {
  if (!summary || typeof summary !== "object") return "";
  return Object.entries(summary as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number" || typeof v === "string")
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
}

function StatusDot({ status }: { status?: string }) {
  if (status === "ok") return <CircleCheck className="h-3.5 w-3.5" style={{ color: "var(--color-sage)" }} />;
  if (status === "error") return <CircleAlert className="h-3.5 w-3.5" style={{ color: "var(--color-crimson)" }} />;
  return <CircleDashed className="h-3.5 w-3.5" style={{ color: "var(--color-mist-faint)" }} />;
}

export default function AgentStatus() {
  const { data } = trpc.n8n.getAgentStatus.useQuery();
  const agents = (data?.agents ?? []) as Agent[];
  const byJob = new Map(agents.map((a) => [a.job, a]));
  const health = data?.health as { briefs?: number; chunks?: number; signals?: Record<string, number> } | undefined;
  const sig = health?.signals ?? {};

  return (
    <div className="rounded-xl border bg-card p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-3" style={{ color: "var(--color-mist-dim)", fontSize: 10, letterSpacing: "0.08em" }}>
        <Activity className="h-3.5 w-3.5" style={{ color: "var(--color-cyan)" }} />
        Agents
      </div>

      <div className="space-y-2.5">
        {JOB_ORDER.map((job) => {
          const a = byJob.get(job);
          const summary = a ? summarise(a.summary) : "";
          return (
            <div key={job} className="flex items-start gap-2">
              <span className="mt-0.5"><StatusDot status={a?.status} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: "var(--color-mist)" }}>{JOB_META[job].label}</span>
                  <span className="font-mono ml-auto shrink-0" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>{a ? ago(a.finished_at) : "no runs"}</span>
                </div>
                {summary && <div className="font-mono truncate" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>{summary}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-x-4 gap-y-1 flex-wrap font-mono" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>
        <span><strong style={{ color: "var(--color-mist-dim)" }}>{health?.briefs ?? 0}</strong> briefs</span>
        <span><strong style={{ color: "var(--color-mist-dim)" }}>{sig.open ?? 0}</strong> open</span>
        <span><strong style={{ color: "var(--color-cat-markets)" }}>{sig.realised ?? 0}</strong> realised</span>
        <span><strong style={{ color: "var(--color-mist-dim)" }}>{health?.chunks ?? 0}</strong> embedded</span>
      </div>
    </div>
  );
}
