/**
 * Markets grid — TD + Alpha Vantage data (server-fetched, cached), themed to the
 * dashboard. Each card resolves the briefs' threshold signals against its live
 * series (realised once on first crossing).
 */

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { MarketCard, MarketCardSkeleton } from "@/components/MarketCard";
import { marketThresholdSignals, type BoundSignal } from "@/lib/trendsAnalysis";
import type { DailyBrief } from "@/lib/briefParser";
import { cn } from "@/lib/utils";

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

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 12 }).map((_, i) => <MarketCardSkeleton key={i} />)
          : instruments.map((inst) => (
              <MarketCard key={inst.symbol} data={inst} range={range} signals={signalsBySymbol[inst.symbol] ?? []} />
            ))}
      </div>

      <p className="text-[10px] font-mono mt-4 text-right" style={{ color: "var(--color-mist-faint)" }}>
        Data via Twelve Data &amp; Alpha Vantage · daily close · cached server-side
      </p>
    </section>
  );
}
