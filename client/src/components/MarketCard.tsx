/**
 * One market instrument card — themed to the Daily Ripple navy palette (not the
 * reference dark/emerald theme). Navy `bg-card`, mist text, mono labels, and
 * sage/crimson for up/down; the instrument's own accent colours the sparkline.
 */

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import type { MarketInstrument } from "@/hooks/useMarkets";
import { formatPrice, formatVolume, formatTick, exchangeLabel } from "@/lib/marketFormat";

const UP = "var(--color-sage)";
const DOWN = "var(--color-crimson)";
const FLAT = "var(--color-mist-faint)";

const statLabel = "text-[9px] uppercase tracking-[0.12em] mb-0.5";

export function MarketCardSkeleton() {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-card border border-border/50 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-white/10" />
          <div>
            <div className="w-20 h-3 mb-1 rounded bg-white/10" />
            <div className="w-14 h-2 rounded bg-white/10" />
          </div>
        </div>
        <div className="w-16 h-5 rounded bg-white/10" />
      </div>
      <div className="w-full h-[72px] rounded bg-white/5" />
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30">
        <div className="h-6 rounded bg-white/5" />
        <div className="h-6 rounded bg-white/5" />
        <div className="h-6 rounded bg-white/5" />
      </div>
    </div>
  );
}

export function MarketCard({ data, range }: { data: MarketInstrument; range: string }) {
  const isFlat = Math.abs(data.dayChangePct) < 0.01;
  const isUp = data.dayChangePct >= 0;
  const trend = isFlat ? FLAT : isUp ? UP : DOWN;

  const series = data.series;
  const minV = useMemo(() => (series.length ? Math.min(...series.map((p) => p.v)) : 0), [series]);
  const maxV = useMemo(() => (series.length ? Math.max(...series.map((p) => p.v)) : 1), [series]);
  const pad = (maxV - minV) * 0.15 || 1;

  const rangePos =
    data.fiftyTwoWeekHigh > data.fiftyTwoWeekLow
      ? ((data.currentPrice - data.fiftyTwoWeekLow) / (data.fiftyTwoWeekHigh - data.fiftyTwoWeekLow)) * 100
      : 50;

  if (data.error) {
    return (
      <div className="rounded-xl p-4 flex items-center gap-3 bg-card border border-border/50" style={{ color: "var(--color-mist-faint)" }}>
        <AlertCircle className="w-4 h-4 shrink-0" />
        <div>
          <div className="text-xs font-mono">{data.flag} {data.label}</div>
          <div className="text-xs mt-0.5">Data unavailable</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group rounded-xl p-4 flex flex-col gap-3 bg-card border border-border/50 transition-colors"
      style={{ ["--accent" as string]: data.color }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = data.color + "55")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base leading-none">{data.flag}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--color-mist)" }}>{data.label}</div>
            <div className="text-[10px] font-mono mt-0.5 tracking-[0.04em]" style={{ color: "var(--color-mist-faint)" }}>
              {exchangeLabel(data)}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-semibold tabular-nums" style={{ color: "var(--color-mist)" }}>
            {formatPrice(data.currentPrice, data)}
          </div>
          <div className="flex items-center justify-end gap-1 mt-0.5" style={{ color: trend }}>
            {isFlat ? <Minus className="w-3 h-3" /> : isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span className="text-[11px] font-mono">{isUp ? "+" : ""}{data.dayChangePct.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      {series.length > 1 ? (
        <ResponsiveContainer width="100%" height={72}>
          <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={data.color} stopOpacity={0.22} />
                <stop offset="95%" stopColor={data.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ts"
              tickFormatter={(ts) => formatTick(ts, range)}
              tick={{ fontSize: 8, fill: "var(--color-mist-faint)" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis domain={[minV - pad, maxV + pad]} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { ts: number; v: number };
                return (
                  <div className="rounded px-2 py-1 text-[10px] font-mono border border-border/60" style={{ background: "var(--color-ink-well)" }}>
                    <div style={{ color: data.color }}>{formatPrice(p.v, data)}</div>
                    <div style={{ color: "var(--color-mist-faint)" }}>{formatTick(p.ts, range)}</div>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="v" stroke={data.color} strokeWidth={1.5} fill={`url(#grad-${data.symbol})`} dot={false} activeDot={{ r: 3, fill: data.color, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[72px] flex items-center justify-center text-[10px]" style={{ color: "var(--color-mist-faint)" }}>
          No chart data
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30">
        <div>
          <div className={statLabel} style={{ color: "var(--color-mist-faint)" }}>Day Chg</div>
          <div className="text-[11px] font-mono" style={{ color: trend }}>
            {isUp ? "+" : ""}{data.dayChange.toFixed(data.isFx ? 4 : 2)}
          </div>
        </div>
        <div>
          <div className={statLabel} style={{ color: "var(--color-mist-faint)" }}>Range Chg</div>
          <div className="text-[11px] font-mono" style={{ color: data.rangeChangePct >= 0 ? UP : DOWN }}>
            {data.rangeChangePct >= 0 ? "+" : ""}{data.rangeChangePct.toFixed(2)}%
          </div>
        </div>
        {data.isFx || data.isYield ? (
          <div>
            <div className={statLabel} style={{ color: "var(--color-mist-faint)" }}>Prev Close</div>
            <div className="text-[11px] font-mono" style={{ color: "var(--color-mist-dim)" }}>{formatPrice(data.prevClose, data)}</div>
          </div>
        ) : (
          <div>
            <div className={statLabel} style={{ color: "var(--color-mist-faint)" }}>Volume</div>
            <div className="text-[11px] font-mono" style={{ color: "var(--color-mist-dim)" }}>{formatVolume(data.regularMarketVolume)}</div>
          </div>
        )}
      </div>

      {/* 52-week range bar (equity indices + commodities) */}
      {data.fiftyTwoWeekHigh > 0 && !data.isFx && !data.isYield && (
        <div>
          <div className="flex justify-between text-[9px] mb-1" style={{ color: "var(--color-mist-faint)" }}>
            <span>52W L: {formatPrice(data.fiftyTwoWeekLow, data)}</span>
            <span>52W H: {formatPrice(data.fiftyTwoWeekHigh, data)}</span>
          </div>
          <div className="h-1 rounded-full relative overflow-hidden" style={{ background: "var(--border)" }}>
            <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, rangePos))}%`, background: data.color, opacity: 0.5 }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ left: `calc(${Math.max(2, Math.min(98, rangePos))}% - 3px)`, background: data.color }} />
          </div>
        </div>
      )}
    </div>
  );
}
