/**
 * Signals freshness — the reader-facing replacement for the raw Agents/telemetry
 * panel (UX-revamp §6.2 / punch-list item 4). On mobile & tablet the whole
 * agent panel collapses to a single freshness line; on desktop a calm,
 * simplified widget sits in the right rail for readers who want the operational
 * detail without it reading as a debug console. The full per-job telemetry now
 * lives on the admin page.
 *
 * pg returns bigint `finished_at` as a STRING — coerce with Number().
 */

import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

type Agent = { job: string; status: string; finished_at: unknown; summary: unknown };

/** "just now" / "3h ago" / "2d ago" from an epoch-ms value (string or number). */
function ago(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Most recent successful run across all jobs → the page's "last synced" time. */
function useFreshness() {
  const { data } = trpc.n8n.getAgentStatus.useQuery();
  const agents = (data?.agents ?? []) as Agent[];
  const latest = agents.reduce((max, a) => Math.max(max, Number(a.finished_at) || 0), 0);
  const health = data?.health as { signals?: Record<string, number> } | undefined;
  const sig = health?.signals ?? {};
  return { updated: latest ? ago(latest) : null, open: sig.open ?? 0, realised: sig.realised ?? 0 };
}

/** Compact one-liner — mobile & tablet. */
export function FreshnessLine({ className = "" }: { className?: string }) {
  const { updated } = useFreshness();
  if (!updated) return null;
  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] font-mono ${className}`}
      style={{ color: "var(--color-mist-faint)" }}
    >
      <RefreshCw className="h-3 w-3" style={{ color: "var(--color-cyan)" }} />
      Updated {updated}
    </div>
  );
}

/** Simplified freshness/telemetry widget — desktop right rail. */
export function TelemetryWidget() {
  const { updated, open, realised } = useFreshness();
  if (!updated) return null;
  return (
    <div className="rounded-xl border bg-card p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color: "var(--color-mist-dim)" }}>
        <RefreshCw className="h-3.5 w-3.5" style={{ color: "var(--color-cyan)" }} />
        <span className="text-[13px] font-semibold" style={{ color: "var(--color-mist)" }}>Last sync {updated}</span>
      </div>
      <p className="text-[11px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
        <strong style={{ color: "var(--color-mist-dim)" }}>{open}</strong> signals tracking
        {" · "}
        <strong style={{ color: "var(--color-cat-markets)" }}>{realised}</strong> realised
      </p>
    </div>
  );
}
