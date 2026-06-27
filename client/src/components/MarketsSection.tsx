/**
 * Markets grid — TD + Alpha Vantage data (server-fetched, cached), themed to the
 * dashboard. Each card resolves the briefs' threshold signals against its live
 * series (realised once on first crossing).
 */

import { useMemo, useRef, useState } from "react";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "@/components/MarketCard";
import { marketThresholdSignals, type BoundSignal } from "@/lib/trendsAnalysis";
import type { DailyBrief } from "@/lib/briefParser";
import type { InstrumentGroup } from "@/lib/instruments";
import { cn } from "@/lib/utils";

const GROUPS: { key: InstrumentGroup; label: string }[] = [
  { key: "exchange", label: "Exchanges" },
  { key: "ratecom", label: "Rates & commodities" },
  { key: "fx", label: "FX · vs SGD" },
];

// Keyword-matchable label per symbol for signal binding (e.g. "US 10Y" → yield).
const MATCH_LABEL: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^DJI": "Dow Jones",
  BRENT: "Brent Crude",
  GOLD: "Gold",
  US10Y: "Treasury Yield",
};

const RANGES = [
  { value: "1d", label: "1D" },
  { value: "5d", label: "5D" },
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "ytd", label: "YTD" },
  { value: "1y", label: "1Y" },
  { value: "5y", label: "5Y" },
];

export default function MarketsSection({ briefs }: { briefs: Record<string, DailyBrief> }) {
  const [range, setRange] = useState("1mo");
  const { instruments, loading, fetching, refetch } = useMarkets(range);

  // Subsections as a swipeable deck (like the Today's Brief cards) so Markets
  // stays one-subsection tall and the lead intelligence signal sits higher.
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const touchX = useRef<number | null>(null);
  const n = GROUPS.length;
  const goTo = (next: number) => {
    const wrapped = (next + n) % n;
    setDir(next >= active ? 1 : -1);
    setActive(wrapped);
  };
  const step = (d: 1 | -1) => {
    setDir(d);
    setActive((a) => (a + d + n) % n);
  };
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  };

  const group = GROUPS[active];

  // Bind brief threshold-signals to each instrument's live series, range-independent.
  const signalsBySymbol = useMemo(() => {
    const m: Record<string, BoundSignal[]> = {};
    for (const inst of instruments) {
      m[inst.symbol] = inst.recent?.length
        ? marketThresholdSignals(MATCH_LABEL[inst.symbol] ?? inst.label, inst.recent, briefs)
        : [];
    }
    return m;
  }, [instruments, briefs]);

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--color-gold-rich)" }}>
          Markets
        </h2>
        <p className="text-xs mt-1" style={{ color: "var(--color-mist-dim)" }}>
          Live market data · equity indices, FX, rates &amp; commodities
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg p-1 border border-border/50">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors",
                range === r.value ? "font-semibold" : "hover:bg-white/5"
              )}
              style={
                range === r.value
                  ? { background: "color-mix(in oklab, var(--color-cyan) 16%, transparent)", color: "var(--color-cyan)" }
                  : { color: "var(--color-mist-faint)" }
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={refetch}
          disabled={fetching}
          className="flex items-center gap-1.5 text-[11px] transition-colors disabled:opacity-50 hover:text-[var(--color-cyan)]"
          style={{ color: "var(--color-mist-faint)" }}
        >
          <RefreshCw className={cn("w-3 h-3", fetching && "animate-spin")} />
          <span className="hidden sm:inline">{fetching ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      {/* Subsection deck: one group at a time, swipe / arrows / tabs to navigate */}
      {(() => {
        const items = instruments.filter((i) => i.group === group.key);
        return (
          <div>
            {/* Nav: circular arrows flank the section name + position counter */}
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={() => step(-1)}
                aria-label="Previous market section"
                className="shrink-0 grid place-items-center h-8 w-8 rounded-full border border-border/60 transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
                style={{ color: "var(--color-mist-dim)" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0 flex-1 text-center">
                <div className="text-[13px] font-semibold tracking-[0.04em] uppercase truncate" style={{ color: "var(--color-mist)" }}>
                  {group.label}
                </div>
                <div className="text-[10px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
                  {active + 1} of {n} · swipe or use arrows
                </div>
              </div>

              <button
                onClick={() => step(1)}
                aria-label="Next market section"
                className="shrink-0 grid place-items-center h-8 w-8 rounded-full border border-border/60 transition-colors hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)]"
                style={{ color: "var(--color-mist-dim)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs — explicit, tappable section labels (clear on both platforms) */}
            <div className="flex items-center justify-center gap-1.5 mb-4 flex-wrap">
              {GROUPS.map((g, i) => (
                <button
                  key={g.key}
                  onClick={() => goTo(i)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors"
                  style={
                    i === active
                      ? { background: "color-mix(in oklab, var(--color-cyan) 15%, transparent)", color: "var(--color-cyan)", border: "1px solid color-mix(in oklab, var(--color-cyan) 35%, transparent)" }
                      : { color: "var(--color-mist-faint)", border: "1px solid var(--border)" }
                  }
                >
                  {g.label}
                </button>
              ))}
            </div>

            {/* Slide viewport — touch-swipeable; directional fade on change */}
            <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
              <div key={active} className={dir === 1 ? "mkt-slide-next" : "mkt-slide-prev"}>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {loading
                    ? items.map((i) => <MarketCardSkeleton key={i.symbol} />)
                    : items.map((inst) => (
                        <MarketCard key={inst.symbol} data={inst} range={range} signals={signalsBySymbol[inst.symbol] ?? []} />
                      ))}
                </div>
              </div>
            </div>

            {/* Dots — position at a glance */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {GROUPS.map((g, i) => (
                <button
                  key={g.key}
                  onClick={() => goTo(i)}
                  aria-label={`Go to ${g.label}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === active ? 18 : 6,
                    background: i === active ? "var(--color-cyan)" : "var(--border)",
                  }}
                />
              ))}
            </div>
          </div>
        );
      })()}

      <p className="text-[10px] font-mono mt-4 text-right" style={{ color: "var(--color-mist-faint)" }}>
        Data via Twelve Data &amp; Alpha Vantage · daily close · cached server-side
      </p>
    </section>
  );
}
