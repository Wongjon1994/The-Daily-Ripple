/**
 * Active Watches (Agentic Ripple, Phase D). The open, forward-looking signals the
 * reader is tracking, as a re-orderable list. Order is arranged by dragging the
 * grip and persisted to localStorage (no accounts); realisation is never invented
 * — each row shows only honest metadata (theme, surfaced date, horizon, and the
 * realisation engine's confidence when it has scored one).
 *
 * Reorder uses Pointer Events so it works with both mouse and touch; the ordering
 * itself is the pure, tested lib/watchOrder helpers.
 */

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "wouter";
import { Eye, GripVertical, ArrowUpRight } from "lucide-react";
import type { SignalRow } from "@/lib/trendsView";
import { mergeWatchOrder, moveBefore } from "@/lib/watchOrder";

const STORAGE_KEY = "ripple_watch_order";

const THEME_TAG: Record<string, { label: string; color: string }> = {
  geopolitics: { label: "Geopolitics", color: "var(--color-cat-geopolitics)" },
  ai_tech: { label: "AI & Tech", color: "var(--color-cyan)" },
  society: { label: "Society", color: "var(--color-cat-culture)" },
  rates: { label: "Rates", color: "var(--color-cat-tech)" },
  markets: { label: "Markets", color: "var(--color-cat-science)" },
  energy: { label: "Energy", color: "var(--color-cat-economics)" },
  other: { label: "Signal", color: "var(--color-mist-faint)" },
};
const tag = (theme: string) => THEME_TAG[theme] ?? THEME_TAG.other;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortIso = (s?: string | null) => {
  if (!s) return "";
  const [, m, d] = s.split("-");
  return m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}` : s;
};

function loadOrder(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function WatchRow({
  s,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  s: SignalRow;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
}) {
  const t = tag(s.theme);
  const horizon = s.horizonDate ?? s.expiryDate ?? null;
  return (
    <div
      data-watch-id={s.id}
      className="flex items-start gap-2 rounded-md border border-border/50 bg-[var(--color-ink-well)] p-2.5 transition-colors"
      style={{ opacity: dragging ? 0.5 : 1, borderColor: dragging ? "var(--color-cyan-dim)" : undefined }}
    >
      <span
        role="button"
        aria-label="Drag to reorder"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="mt-0.5 cursor-grab active:cursor-grabbing"
        style={{ touchAction: "none" }}
      >
        <GripVertical className="h-3.5 w-3.5" style={{ color: "var(--color-mist-faint)" }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono uppercase tracking-[0.06em] rounded px-1" style={{ color: t.color, background: `color-mix(in oklab, ${t.color} 12%, transparent)`, fontSize: 9 }}>
            {t.label}
          </span>
          {typeof s.confidence === "number" && (
            <span className="font-mono" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>conf {s.confidence.toFixed(2)}</span>
          )}
          <Link
            href={`/brief/${s.briefDateSlug}?story=${s.storyIndex + 1}`}
            className="font-mono ml-auto flex items-center gap-0.5 shrink-0 transition-colors hover:text-[var(--color-cyan)]"
            style={{ color: "var(--color-mist-faint)", fontSize: 9 }}
          >
            {shortIso(s.surfacedDate)}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <p className="leading-snug line-clamp-2" style={{ color: "var(--color-mist-dim)", fontSize: 12 }}>{s.signalText}</p>
        {horizon && (
          <div className="font-mono mt-1" style={{ color: "var(--color-mist-faint)", fontSize: 9 }}>through {shortIso(horizon)}</div>
        )}
      </div>
    </div>
  );
}

export default function ActiveWatches({ signals }: { signals: SignalRow[] }) {
  const open = useMemo(
    () => signals.filter((s) => s.status === "open").sort((a, b) => (a.surfacedDate < b.surfacedDate ? 1 : -1)),
    [signals]
  );
  const byId = useMemo(() => new Map(open.map((s) => [s.id, s])), [open]);

  const [order, setOrder] = useState<number[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragId = useRef<number | null>(null);
  const orderRef = useRef<number[]>(order);
  useEffect(() => { orderRef.current = order; }, [order]);

  // Reconcile the persisted arrangement with the live open set whenever it changes.
  useEffect(() => {
    setOrder((prev) => {
      const base = prev.length ? prev : loadOrder();
      return mergeWatchOrder(base, open.map((s) => s.id));
    });
  }, [open]);

  const save = (next: number[]) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // Pointer-based drag (mouse + touch): capture on the grip, hit-test the row
  // under the pointer, and reorder live; persist on release.
  const onPointerDown = (id: number) => (e: ReactPointerEvent) => {
    e.preventDefault();
    dragId.current = id;
    setDraggingId(id);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (dragId.current == null) return;
    const row = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest("[data-watch-id]");
    const overId = row ? Number(row.getAttribute("data-watch-id")) : NaN;
    if (!overId || overId === dragId.current) return;
    setOrder((prev) => moveBefore(prev, dragId.current!, overId));
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (dragId.current == null) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    dragId.current = null;
    setDraggingId(null);
    save(orderRef.current);
  };

  const ordered = order.map((id) => byId.get(id)).filter((s): s is SignalRow => Boolean(s));

  return (
    <div className="rounded-xl border bg-card p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-3" style={{ color: "var(--color-mist-dim)", fontSize: 10, letterSpacing: "0.08em" }}>
        <Eye className="h-3.5 w-3.5" style={{ color: "var(--color-cyan)" }} />
        Active watches
        {ordered.length > 0 && <span className="ml-auto" style={{ color: "var(--color-mist-faint)" }}>{ordered.length}</span>}
      </div>

      {ordered.length === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-faint)" }}>
          No active watches yet. Forward-looking signals appear here as briefs publish — drag to arrange your own priority.
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {ordered.map((s) => (
            <WatchRow
              key={s.id}
              s={s}
              dragging={draggingId === s.id}
              onPointerDown={onPointerDown(s.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          ))}
        </div>
      )}
    </div>
  );
}
