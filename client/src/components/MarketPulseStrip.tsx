/**
 * Market-pulse strip — a compact glance at ~6 headline instruments that sits at
 * the top of the Signals page. Each chip shows price, day change and a mini
 * sparkline; tap a chip to expand an inline detail row. The full Markets carousel
 * (ranges, all instruments, bound threshold signals) lives lower down the page.
 *
 * Uses its own fixed-range fetch so the sparkline window stays stable regardless
 * of what range the carousel below is set to. The server caches per symbol, so
 * this second read is served from cache — no extra upstream API calls.
 */

import { useMemo, useState } from "react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Minus, CircleCheck, Eye } from "lucide-react";
import { useMarkets, type MarketInstrument } from "@/hooks/useMarkets";
import { formatPrice, exchangeLabel } from "@/lib/marketFormat";
import { marketThresholdSignals, type BoundSignal } from "@/lib/trendsAnalysis";
import type { DailyBrief } from "@/lib/briefParser";
import { cn } from "@/lib/utils";

// The full market set — the pulse is now the single markets surface, so it
// carries every instrument: US indices, rates & commodities, then FX vs SGD.
const PULSE_SYMBOLS = [
  "^GSPC", "^NDX", "^DJI", "US10Y", "BRENT", "GOLD",
  "USDSGD", "EURSGD", "GBPSGD", "JPYSGD", "AUDSGD", "CNYSGD",
];

// Keyword-matchable label per symbol for binding brief threshold-signals
// (indices/rates/commodities; FX pairs fall back to their instrument label).
const MATCH_LABEL: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^NDX": "Nasdaq",
  "^DJI": "Dow Jones",
  US10Y: "Treasury Yield",
  BRENT: "Brent Crude",
  GOLD: "Gold",
  USDSGD: "Singapore dollar",
};

const UP = "var(--color-sage)";
const DOWN = "var(--color-crimson)";
const FLAT = "var(--color-mist-faint)";

const trendOf = (pct: number) => (Math.abs(pct) < 0.01 ? FLAT : pct >= 0 ? UP : DOWN);

/** Tiny inline sparkline drawn from the instrument's series — no axes, no chrome. */
function Spark({ series, color, w = 96, h = 26, fluid = false }: { series: { v: number }[]; color: string; w?: number; h?: number; fluid?: boolean }) {
  if (series.length < 2) return <div className={fluid ? "w-full" : undefined} style={{ width: fluid ? undefined : w, height: h }} />;
  const vs = series.map((p) => p.v);
  const min = Math.min(...vs);
  const span = Math.max(...vs) - min || 1;
  const pts = series
    .map((p, i) => `${(i / (series.length - 1)) * w},${h - ((p.v - min) / span) * h}`)
    .join(" ");
  return (
    <svg
      width={fluid ? undefined : w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={fluid ? "w-full" : undefined}
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function PulseChip({ inst, active, signal, onClick }: { inst: MarketInstrument; active: boolean; signal?: BoundSignal; onClick: () => void }) {
  const trend = trendOf(inst.dayChangePct);
  const isUp = inst.dayChangePct >= 0;
  const isFlat = Math.abs(inst.dayChangePct) < 0.01;
  return (
    <button
      onClick={onClick}
      aria-expanded={active}
      className="text-left rounded-lg border bg-card px-3 py-2.5 transition-colors"
      style={{ borderColor: active ? `color-mix(in oklab, ${inst.color} 45%, transparent)` : "var(--border)" }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {inst.icon ? (
          <inst.icon className="h-3.5 w-3.5 shrink-0" style={{ color: inst.color }} aria-hidden="true" />
        ) : (
          <span className="text-xs leading-none">{inst.flag}</span>
        )}
        <span className="text-[11px] font-semibold truncate" style={{ color: "var(--color-mist)" }}>
          {inst.label}
        </span>
        {/* A bound brief signal on this instrument — tap to see it in the detail. */}
        {signal?.threshold && (
          signal.status === "realised" ? (
            <CircleCheck className="h-3 w-3 shrink-0 ml-auto" style={{ color: "var(--color-sage)" }} aria-label="Flagged signal realised" />
          ) : (
            <Eye className="h-3 w-3 shrink-0 ml-auto" style={{ color: "var(--color-gold-rich)" }} aria-label="Watching a flagged signal" />
          )
        )}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="shrink-0">
          <div className="text-sm font-semibold tabular-nums leading-none" style={{ color: "var(--color-mist)" }}>
            {inst.error ? "—" : formatPrice(inst.currentPrice, inst)}
          </div>
          <div className="mt-1 flex items-center gap-0.5" style={{ color: trend }}>
            {isFlat ? <Minus className="h-2.5 w-2.5" /> : isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            <span className="text-[10px] font-mono">
              {isUp && !isFlat ? "+" : ""}
              {inst.error ? "—" : `${inst.dayChangePct.toFixed(2)}%`}
            </span>
          </div>
        </div>
        {/* Fluid sparkline — shrinks before the price does, capped at 96px so it
            never crowds the number in the 2-column mobile layout. */}
        <div className="flex-1 min-w-0 max-w-[96px] flex justify-end">
          <Spark series={inst.series} color={inst.color} fluid />
        </div>
      </div>
    </button>
  );
}

/** The instrument's headline bound signal — a brief-flagged level resolved on
 *  this series (realised on first crossing, else still watching). Links to the
 *  story that flagged it. Preserves the binding that lived on the old Markets
 *  cards now that Markets is consolidated into the pulse. */
function PulseSignal({ inst, signal }: { inst: MarketInstrument; signal: BoundSignal }) {
  if (!signal.threshold) return null;
  const realised = signal.status === "realised";
  const accent = realised ? "var(--color-sage)" : "var(--color-gold-rich)";
  return (
    <Link
      href={`/brief/${signal.signal.slug}/${signal.signal.storyIndex + 1}`}
      className="mt-3 block rounded-md px-2.5 py-2 border transition-colors hover:brightness-110"
      style={{
        borderColor: `color-mix(in oklab, ${accent} 32%, transparent)`,
        background: `color-mix(in oklab, ${accent} 8%, transparent)`,
      }}
      title={signal.signal.text}
    >
      <div className="flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: "var(--color-mist-dim)" }}>
        {realised ? (
          <CircleCheck className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: accent }} />
        ) : (
          <Eye className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: accent }} />
        )}
        <span>
          {realised ? (
            <>
              Flagged {signal.threshold.direction} {formatPrice(signal.threshold.value, inst)} → hit{" "}
              <span style={{ color: accent }}>{formatPrice(parseFloat(signal.realisation!.value), inst)}</span>{" "}
              (+{signal.realisation!.lagDays}d)
            </>
          ) : (
            <>Watching {signal.threshold.direction} {formatPrice(signal.threshold.value, inst)}</>
          )}
        </span>
      </div>
    </Link>
  );
}

function PulseDetail({ inst, signal }: { inst: MarketInstrument; signal?: BoundSignal }) {
  const stat = (label: string, value: string, color = "var(--color-mist-dim)") => (
    <div>
      <div className="text-[9px] uppercase tracking-[0.12em] mb-0.5" style={{ color: "var(--color-mist-faint)" }}>{label}</div>
      <div className="text-[12px] font-mono" style={{ color }}>{value}</div>
    </div>
  );
  const isUp = inst.dayChangePct >= 0;
  return (
    <div className="mt-2 rounded-lg border border-border/60 bg-[var(--color-ink-well)] p-3">
      <div className="flex items-center gap-1.5 mb-2.5">
        {inst.icon ? (
          <inst.icon className="h-4 w-4" style={{ color: inst.color }} aria-hidden="true" />
        ) : (
          <span className="text-sm leading-none">{inst.flag}</span>
        )}
        <span className="text-[13px] font-semibold" style={{ color: "var(--color-mist)" }}>{inst.label}</span>
        <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--color-mist-faint)" }}>{exchangeLabel(inst)}</span>
      </div>
      <div className="mb-3">
        <Spark series={inst.series} color={inst.color} w={320} h={44} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stat("Day Chg", `${isUp ? "+" : ""}${inst.dayChange.toFixed(inst.isFx ? 4 : 2)}`, trendOf(inst.dayChangePct))}
        {stat("Range Chg (1M)", `${inst.rangeChangePct >= 0 ? "+" : ""}${inst.rangeChangePct.toFixed(2)}%`, inst.rangeChangePct >= 0 ? UP : DOWN)}
        {inst.isFx || inst.isYield
          ? stat("Prev Close", formatPrice(inst.prevClose, inst))
          : stat("52W Range", `${formatPrice(inst.fiftyTwoWeekLow, inst)} – ${formatPrice(inst.fiftyTwoWeekHigh, inst)}`)}
      </div>
      {signal?.threshold && <PulseSignal inst={inst} signal={signal} />}
    </div>
  );
}

export default function MarketPulseStrip({ briefs = {} }: { briefs?: Record<string, DailyBrief> }) {
  const { instruments, loading } = useMarkets("1mo");
  const [expanded, setExpanded] = useState<string | null>(null);

  const pulse = useMemo(() => {
    const bySymbol = new Map(instruments.map((i) => [i.symbol, i]));
    return PULSE_SYMBOLS.map((s) => bySymbol.get(s)).filter((i): i is MarketInstrument => Boolean(i));
  }, [instruments]);

  // Bind brief threshold-signals to each pulse instrument's series (the headline
  // one surfaces in the chip indicator + expanded detail).
  const signalBySymbol = useMemo(() => {
    const m: Record<string, BoundSignal | undefined> = {};
    for (const inst of pulse) {
      const bound = inst.recent?.length
        ? marketThresholdSignals(MATCH_LABEL[inst.symbol] ?? inst.label, inst.recent, briefs)
        : [];
      m[inst.symbol] = bound[0];
    }
    return m;
  }, [pulse, briefs]);

  const active = pulse.find((i) => i.symbol === expanded) ?? null;

  return (
    <section aria-label="Market pulse">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--color-cyan)" }} />
        <h2 className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-mist-dim)" }}>
          Market pulse
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {PULSE_SYMBOLS.map((s) => (
            <div key={s} className="h-[74px] rounded-lg border border-border/50 bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {pulse.map((inst) => (
              <PulseChip
                key={inst.symbol}
                inst={inst}
                active={inst.symbol === expanded}
                signal={signalBySymbol[inst.symbol]}
                onClick={() => setExpanded((cur) => (cur === inst.symbol ? null : inst.symbol))}
              />
            ))}
          </div>
          {active && <PulseDetail inst={active} signal={signalBySymbol[active.symbol]} />}
        </>
      )}
    </section>
  );
}
