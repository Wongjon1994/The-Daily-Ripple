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
import { Eye, GripVertical, ArrowUpRight, CircleCheck } from "lucide-react";
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

const REALISED = "var(--color-cat-markets)";

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

/** A realised watch — read-only, showing when the call came true. */
function RealisedRow({ s }: { s: SignalRow }) {
  const t = tag(s.theme);
  return (
    <Link
      href={`/brief/${s.briefDateSlug}?story=${s.storyIndex + 1}`}
      className="block rounded-md border border-border/50 bg-[var(--color-ink-well)] p-2.5 transition-colors hover:border-[color-mix(in_oklab,var(--color-cat-markets)_45%,transparent)]"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono uppercase tracking-[0.06em] rounded px-1" style={{ color: t.color, background: `color-mix(in oklab, ${t.color} 12%, transparent)`, fontSize: 9 }}>
          {t.label}
        </span>
        <span className="flex items-center gap-1 font-mono uppercase" style={{ color: REALISED, fontSize: 9, letterSpacing: "0.06em" }}>
          <CircleCheck className="h-3 w-3" />
          Realised{s.realisedDate ? ` ${shortIso(s.realisedDate)}` : ""}
        </span>
        <ArrowUpRight className="h-3 w-3 ml-auto shrink-0" style={{ color: "var(--color-mist-faint)" }} />
      </div>
      <p className="leading-snug line-clamp-2" style={{ color: "var(--color-mist-dim)", fontSize: 12 }}>{s.signalText}</p>
      {s.realisedEvidenceNote && (
        <p className="leading-snug mt-1 line-clamp-2" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>{s.realisedEvidenceNote}</p>
      )}
    </Link>
  );
}

type WatchView = "open" | "realised";

export default function ActiveWatches({ signals }: { signals: SignalRow[] }) {
  const [view, setView] = useState<WatchView>("open");

  const open = useMemo(
    () => signals.filter((s) => s.status === "open").sort((a, b) => (a.surfacedDate < b.surfacedDate ? 1 : -1)),
    [signals]
  );
  const realised = useMemo(
    () =>
      signals
        .filter((s) => s.status === "realised")
        .sort((a, b) => ((a.realisedDate ?? a.surfacedDate) < (b.realisedDate ?? b.surfacedDate) ? 1 : -1)),
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

  const hasAny = open.length > 0 || realised.length > 0;

  return (
    <div className="rounded-xl border bg-card p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-cyan)" }} />
        <span className="font-mono font-semibold uppercase" style={{ color: "var(--color-mist-dim)", fontSize: 10, letterSpacing: "0.08em" }}>
          Active watches
        </span>
        {hasAny && (
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="Filter watches">
            {(["open", "realised"] as const).map((v) => {
              const n = v === "open" ? open.length : realised.length;
              const accent = v === "realised" ? REALISED : "var(--color-cyan)";
              const on = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={on}
                  className="rounded-md border px-2 py-0.5 font-mono uppercase transition-colors"
                  style={
                    on
                      ? { fontSize: 9, letterSpacing: "0.06em", color: accent, borderColor: `color-mix(in oklab, ${accent} 40%, transparent)`, background: `color-mix(in oklab, ${accent} 14%, transparent)` }
                      : { fontSize: 9, letterSpacing: "0.06em", color: "var(--color-mist-faint)", borderColor: "var(--border)", background: "transparent" }
                  }
                >
                  {v === "open" ? "Open" : "Realised"} {n}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {view === "open" ? (
        ordered.length === 0 ? (
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
        )
      ) : realised.length === 0 ? (
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-faint)" }}>
          No watches have been realised yet. When a flagged call comes true, it moves here.
        </p>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {realised.map((s) => <RealisedRow key={s.id} s={s} />)}
        </div>
      )}
    </div>
  );
}
