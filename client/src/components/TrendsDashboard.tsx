/**
 * Trends Dashboard.
 *  · Tracked metrics — anything reported in ≥2 briefs (quantitative → sparkline,
 *    qualitative → value timeline), with realised / watching signal callouts.
 *  · Broader signals — grouped by theme rather than listed per story.
 *
 * All analysis lives in lib/trendsAnalysis.ts; this file only renders.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import type { DailyBrief } from "@/lib/briefParser";
import {
  buildWatchSignals,
  buildTrackedMetrics,
  groupBroaderSignals,
  type TrackedMetric,
  type BoundSignal,
  type Threshold,
  type MetricPoint,
} from "@/lib/trendsAnalysis";
import {
  ChevronDown, TrendingUp, TrendingDown, Minus, Telescope, ArrowUpRight,
  CircleCheck, Eye, Flame, Landmark, Cpu, Shield, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const THEME_ICONS: Record<string, typeof Flame> = {
  Flame, Landmark, Cpu, Shield, TrendingUp, Sparkles, Telescope,
};

const CATEGORY_COLORS: Record<string, string> = {
  geopolitics: "var(--color-cat-geopolitics)",
  economics: "var(--color-cat-economics)",
  business: "var(--color-cat-economics)",
  "ai-tech": "var(--color-cat-tech)",
  tech: "var(--color-cat-tech)",
  science: "var(--color-cat-science)",
  culture: "var(--color-cat-culture)",
  systems: "var(--color-cat-science)",
};

// Per-theme accent colours (from the realisation mockup) — a distinct voice each.
const THEME_COLORS: Record<string, string> = {
  energy: "var(--color-cat-economics)",     // amber/gold
  rates: "var(--color-cat-tech)",           // slate blue
  ai_tech: "var(--color-cyan)",             // cyan
  geopolitics: "var(--color-cat-geopolitics)", // terracotta red
  markets: "var(--color-cat-science)",      // indigo/violet
  society: "var(--color-cat-culture)",      // coral
  other: "var(--color-mist-faint)",
};

const REALISED = "var(--color-cat-markets)"; // teal-green
const WATCH = "var(--color-amber)";
const shortDate = (d: string) => d.replace(/,?\s*2026$/, "");
/** "June 19, 2026" → "Jun 19" — compact enough for the card footer. */
const compactDate = (d: string) => shortDate(d).replace(/^(\w{3})\w*/, "$1");
const dirColor = (d?: "up" | "down" | "neutral") =>
  d === "up" ? REALISED : d === "down" ? "var(--color-cat-geopolitics)" : "var(--color-mist-faint)";

function DirectionIcon({ direction }: { direction?: "up" | "down" | "neutral" }) {
  if (direction === "up") return <TrendingUp className="h-3.5 w-3.5" style={{ color: REALISED }} />;
  if (direction === "down") return <TrendingDown className="h-3.5 w-3.5" style={{ color: "var(--color-cat-geopolitics)" }} />;
  return <Minus className="h-3.5 w-3.5" style={{ color: "var(--color-mist-faint)" }} />;
}

/** Sparkline with watch/realised threshold lines and a marker at each crossing. */
function Sparkline({
  chartPoints,
  thresholds,
  realisedValues,
  realisedDates,
}: {
  chartPoints: MetricPoint[];
  thresholds: Threshold[];
  realisedValues: Set<number>;
  realisedDates: Set<string>;
}) {
  if (chartPoints.length < 2) return null;
  const w = 200, h = 48, pad = 6;
  const vals = chartPoints.map((p) => p.numeric!);
  const span = [...vals, ...thresholds.map((t) => t.value)];
  const min = Math.min(...span), max = Math.max(...span), range = max - min || 1;
  const yOf = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  const coords = chartPoints.map((p, i) => ({
    x: pad + (i / (chartPoints.length - 1)) * (w - pad * 2),
    y: yOf(p.numeric!),
    point: p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  return (
    <div className="relative w-full h-12">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        {thresholds.map((t, i) => (
          <line key={i} x1="0" y1={yOf(t.value)} x2={w} y2={yOf(t.value)}
            stroke={realisedValues.has(t.value) ? REALISED : WATCH}
            strokeWidth="1" strokeDasharray="4 3" opacity="0.9" />
        ))}
        <path d={path} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {coords.map((c, i) => {
        const crossed = realisedDates.has(c.point.date);
        const edge = i === 0 ? "start" : i === coords.length - 1 ? "end" : "mid";
        return (
          <Link
            key={i}
            href={`/brief/${c.point.slug}?story=${c.point.storyIndex + 1}`}
            className="spark-point"
            style={{ left: `${(c.x / w) * 100}%`, top: `${(c.y / h) * 100}%` }}
            aria-label={`${c.point.value} on ${shortDate(c.point.date)} — open the ${shortDate(c.point.date)} brief`}
          >
            <span
              className={cn("spark-dot", i === coords.length - 1 && "spark-dot-last")}
              style={crossed ? { background: REALISED, borderColor: REALISED, transform: "scale(1.25)" } : undefined}
            />
            <span className={cn("spark-label", `spark-label-${edge}`)}>
              <span className="spark-label-val">
                {c.point.value}
                <em>{shortDate(c.point.date)}</em>
              </span>
              <span className="spark-label-story">{c.point.headline}</span>
              <span className="spark-label-cue">Open brief →</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Qualitative metric: a left→right timeline of dated value chips. */
function ValueTimeline({ points }: { points: MetricPoint[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {points.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px]"
          style={{ background: "var(--color-ink-well)", border: "0.5px solid var(--border)" }}>
          <span className="font-mono" style={{ color: "var(--color-mist-faint)" }}>{shortDate(p.date)}</span>
          <span className="font-mono font-semibold" style={{ color: "var(--color-mist)" }}>{p.value}</span>
        </span>
      ))}
    </div>
  );
}

function SignalCallout({ s }: { s: BoundSignal }) {
  const realised = s.status === "realised";
  const color = realised ? REALISED : WATCH;
  return (
    <Link
      href={`/brief/${s.signal.slug}?story=${s.signal.storyIndex + 1}`}
      className="block rounded-lg p-3 transition-colors"
      style={{ background: `color-mix(in oklab, ${color} 9%, transparent)`, border: `0.5px solid color-mix(in oklab, ${color} 30%, transparent)` }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {realised
          ? <CircleCheck className="h-3.5 w-3.5 shrink-0" style={{ color }} />
          : <Eye className="h-3.5 w-3.5 shrink-0" style={{ color }} />}
        <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color }}>
          {realised ? "Realised" : "Watching"}
        </span>
        {s.threshold && (
          <span className="text-[11px] font-mono" style={{ color: "var(--color-mist-dim)" }}>
            {s.threshold.direction} {s.threshold.text}
          </span>
        )}
        <span className="text-[11px] font-mono ml-auto flex items-center gap-1" style={{ color: "var(--color-mist-faint)" }}>
          {shortDate(s.signal.date)}
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
      {realised && s.realisation ? (
        <p className="text-xs" style={{ color: "var(--color-mist-dim)" }}>
          Flagged {shortDate(s.signal.date)} → hit <span className="font-mono font-semibold" style={{ color: "var(--color-mist)" }}>{s.realisation.value}</span> on {shortDate(s.realisation.date)}
          <span style={{ color: "var(--color-mist-faint)" }}> (+{s.realisation.lagDays} day{s.realisation.lagDays === 1 ? "" : "s"})</span>
        </p>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>{s.signal.text}</p>
      )}
    </Link>
  );
}

/**
 * Renders the first `limit` items, with a "Show N more" toggle for the rest —
 * keeps long signal/cue lists from running off the page as briefs accumulate.
 */
function MoreList<T>({
  items,
  limit,
  className,
  render,
}: {
  items: T[];
  limit: number;
  className?: string;
  render: (item: T, i: number) => ReactNode;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, limit);
  return (
    <div className={className}>
      {shown.map(render)}
      {items.length > limit && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full text-[11px] font-semibold tracking-[0.04em] py-2 rounded-lg transition-colors hover:bg-[var(--color-ink-well)]"
          style={{ color: "var(--color-cyan)" }}
        >
          {showAll ? "Show fewer" : `Show ${items.length - limit} more`}
        </button>
      )}
    </div>
  );
}

export default function TrendsDashboard({ briefs }: { briefs: Record<string, DailyBrief> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openThemes, setOpenThemes] = useState<Set<string>>(new Set());

  const { metrics, themes } = useMemo(() => {
    const signals = buildWatchSignals(briefs);
    const claimed = new Set<(typeof signals)[number]>();
    const metrics = buildTrackedMetrics(briefs, signals, claimed);
    const themes = groupBroaderSignals(signals.filter((s) => !claimed.has(s)), briefs);
    return { metrics, themes };
  }, [briefs]);

  const totalRealised = metrics.reduce((n, m) => n + m.realisedCount, 0);

  if (metrics.length === 0 && themes.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "var(--color-mist-faint)" }}>
        No metrics to track yet — trends appear as briefs accumulate.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Tracked metrics ──────────────────────────────────────────────── */}
      {metrics.length > 0 && (
        <section>
          <div
            className="sticky z-20 flex items-baseline justify-between mb-4 py-2 backdrop-blur-md border-b border-border/40"
            style={{ top: "var(--nav-h)", background: "color-mix(in oklab, var(--background) 93%, transparent)" }}
          >
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-gold-rich)" }}>
              Tracked metrics
            </h2>
            <span className="hidden sm:inline text-[11px] font-mono whitespace-nowrap" style={{ color: "var(--color-mist-dim)" }}>
              {metrics.length} reported ≥2× · {totalRealised} signal{totalRealised === 1 ? "" : "s"} realised
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {metrics.map((m) => (
              <MetricCard key={m.label} m={m} isExpanded={expanded === m.label}
                onToggle={() => setExpanded(expanded === m.label ? null : m.label)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Broader signals, grouped by theme ────────────────────────────── */}
      {themes.length > 0 && (
        <section>
          <div
            className="sticky z-20 flex items-center gap-2 mb-1 py-2 backdrop-blur-md border-b border-border/40"
            style={{ top: "var(--nav-h)", background: "color-mix(in oklab, var(--background) 93%, transparent)" }}
          >
            <Telescope className="h-4 w-4" style={{ color: "var(--color-cyan)" }} />
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-cyan)" }}>
              Broader signals · by theme
            </h2>
          </div>
          <p className="text-xs mb-4 mt-3" style={{ color: "var(--color-mist-dim)" }}>
            Forward-looking cues beyond the tracked metrics, grouped by what they're about.
          </p>

          <div className="space-y-2.5">
            {themes.map((t) => {
              const Icon = THEME_ICONS[t.icon] ?? Telescope;
              const open = openThemes.has(t.key);
              const color = THEME_COLORS[t.key] ?? "var(--color-cyan)";
              const preview = t.signals.map((s) => s.signal.text).join(" · ");
              return (
                <div
                  key={t.key}
                  className="trends-theme rounded-lg border bg-card overflow-hidden"
                  style={{
                    ["--theme-accent" as string]: color,
                    ...(open ? { borderColor: `color-mix(in oklab, ${color} 40%, transparent)` } : {}),
                  }}
                >
                  <button
                    onClick={() => setOpenThemes((prev) => {
                      const next = new Set(prev);
                      next.has(t.key) ? next.delete(t.key) : next.add(t.key);
                      return next;
                    })}
                    className="w-full text-left px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                      <span className="text-sm font-semibold tracking-[0.04em] uppercase" style={{ color }}>{t.label}</span>
                      <span className="text-[11px] font-mono ml-auto" style={{ color: "var(--color-mist-faint)" }}>
                        {t.signals.length} signal{t.signals.length === 1 ? "" : "s"}
                        {t.realisedCount > 0 && <span style={{ color: REALISED }}> · {t.realisedCount} realised</span>}
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} style={{ color: "var(--color-mist-faint)" }} />
                    </div>
                    {!open && (
                      <p className="text-xs leading-relaxed mt-1.5 line-clamp-1" style={{ color: "var(--color-mist-faint)" }}>
                        {preview}
                      </p>
                    )}
                  </button>
                  {open && (
                    <MoreList
                      items={t.signals}
                      limit={6}
                      className="px-4 pb-3 space-y-2"
                      render={({ signal, realisation }, i) => (
                        <Link key={i} href={`/brief/${signal.slug}?story=${signal.storyIndex + 1}`}
                          className="block rounded-lg border border-border/40 bg-[var(--color-ink-well)] hover:border-[var(--color-cyan)]/40 transition-colors p-3">
                          <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>{signal.text}</p>
                          <div className="flex items-center gap-2 mt-2 text-[11px]">
                            {realisation && (
                              <span className="font-semibold tracking-[0.08em] uppercase flex items-center gap-1" style={{ color: REALISED }}>
                                <CircleCheck className="h-3 w-3" /> Realised
                              </span>
                            )}
                            <span className="font-mono ml-auto" style={{ color: "var(--color-mist-faint)" }}>{shortDate(signal.date)}</span>
                          </div>
                        </Link>
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function MetricCard({ m, isExpanded, onToggle }: { m: TrackedMetric; isExpanded: boolean; onToggle: () => void }) {
  const latest = m.points[m.points.length - 1];
  const realised = m.signals.filter((s) => s.status === "realised");
  const watching = m.signals.filter((s) => s.status === "watching");
  const topical = m.signals.filter((s) => s.status === "topical");
  const realisedValues = new Set(realised.map((s) => s.threshold!.value));
  const realisedDates = new Set(realised.map((s) => s.realisation!.date));
  // The hero payoff: a flagged level that later printed — Trends' whole reason
  // for being. Surface the most recent one on the face of the card.
  const hero = realised.find((s) => s.realisation && s.threshold);
  // Trend direction from the period delta (reliable) for quant, else the last
  // reading's tagged direction for qualitative series.
  const trend = m.kind === "quant" && m.delta !== null
    ? (m.delta > 0 ? "up" : m.delta < 0 ? "down" : "neutral")
    : latest.direction;
  const accent = realised.length > 0 ? REALISED : dirColor(trend);
  const signalCount = realised.length + watching.length;

  return (
    <div
      className={cn("rounded-lg border bg-card transition-colors", isExpanded ? "sm:col-span-2" : "hover:border-[var(--color-cyan)]/40")}
      style={{
        borderColor: isExpanded
          ? "color-mix(in oklab, var(--color-cyan) 40%, transparent)"
          : realised.length > 0
            ? `color-mix(in oklab, ${REALISED} 38%, transparent)`
            : "var(--border)",
      }}
    >
      {/* Tappable summary (top) — toggles the detail panel */}
      <button onClick={onToggle} className="w-full text-left px-4 pt-4 pb-3">
        {/* Kicker rule — trend-coloured (green realised / up, red down) */}
        <div className="h-[2px] w-8 rounded-full mb-2.5" style={{ background: accent, opacity: 0.85 }} />

        <div className="flex items-start justify-between gap-3 mb-2">
          <span className="text-[13px] font-semibold tracking-[0.05em] uppercase" style={{ color: "var(--color-mist)" }}>{m.label}</span>
          <div className="flex items-center gap-2 shrink-0">
            {realised.length > 0 && (
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1"
                style={{ color: REALISED, background: `color-mix(in oklab, ${REALISED} 14%, transparent)` }}>
                <CircleCheck className="h-3 w-3" /> {realised.length} realised
              </span>
            )}
            {realised.length === 0 && watching.length > 0 && (
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1"
                style={{ color: WATCH, background: `color-mix(in oklab, ${WATCH} 12%, transparent)` }}>
                <Eye className="h-3 w-3" /> watching
              </span>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
          <span className="text-2xl font-mono font-semibold leading-none" style={{ color: "var(--color-mist)" }}>{latest.value}</span>
          {m.kind === "quant" && m.delta !== null && (
            <span className="flex items-center gap-1 text-xs font-mono whitespace-nowrap" style={{ color: dirColor(m.delta > 0 ? "up" : m.delta < 0 ? "down" : "neutral") }}>
              <DirectionIcon direction={m.delta > 0 ? "up" : m.delta < 0 ? "down" : "neutral"} />
              {m.delta > 0 ? "+" : ""}{m.delta.toFixed(1)}%
            </span>
          )}
          {m.kind === "qual" && (
            <span className="text-[11px] font-mono uppercase tracking-wide" style={{ color: "var(--color-mist-faint)" }}>qualitative</span>
          )}
        </div>
      </button>

      {/* Chart — each reading links to its brief; hover reveals the story.
          Lives outside the toggle button so the points can be real links. */}
      <div className="px-4 pt-3 pb-1">
        {m.kind === "quant"
          ? <Sparkline chartPoints={m.chartPoints} thresholds={m.thresholds} realisedValues={realisedValues} realisedDates={realisedDates} />
          : <ValueTimeline points={m.points} />}
      </div>

      {/* Payoff + footer — also toggles the detail panel */}
      <button onClick={onToggle} className="w-full text-left px-4 pt-2 pb-4">
        {/* Realisation payoff line — the trust moment, on the card face */}
        {hero && (
          <div className="flex items-start gap-1.5 rounded-md px-2.5 py-1.5 mb-1" style={{ background: `color-mix(in oklab, ${REALISED} 10%, transparent)` }}>
            <CircleCheck className="h-3.5 w-3.5 mt-px shrink-0" style={{ color: REALISED }} />
            <span className="text-[11px] leading-snug" style={{ color: "var(--color-mist-dim)" }}>
              Flagged <span className="font-mono">{hero.threshold!.direction} {hero.threshold!.text}</span>
              {" → hit "}
              <span className="font-mono font-semibold" style={{ color: REALISED }}>{hero.realisation!.value}</span>{" "}
              <span style={{ color: "var(--color-mist-faint)" }}>(+{hero.realisation!.lagDays}d)</span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 mt-2 pt-2.5 border-t border-border/30">
          <span className="text-[11px] font-mono whitespace-nowrap" style={{ color: "var(--color-mist-faint)" }}>
            {compactDate(m.points[0].date)} – {compactDate(latest.date)}
            <span className="ml-1.5 opacity-70">· {m.points.length} pts</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: "var(--color-cyan)" }}>
            {isExpanded ? "Hide" : signalCount > 0 ? "Signal ledger" : "Explore"}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
          </span>
        </div>
      </button>

      {isExpanded && (
        <>
          {(realised.length > 0 || watching.length > 0) && (
            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-2">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: "var(--color-mist-faint)" }}>
                Signal ledger
              </p>
              {[...realised, ...watching].map((s, i) => <SignalCallout key={i} s={s} />)}
            </div>
          )}

          {topical.length > 0 && (
            <div className="border-t border-border/40 px-4 pb-4">
              <p className="text-[11px] font-semibold tracking-[0.15em] uppercase pt-3 mb-2" style={{ color: "var(--color-amber)" }}>
                Related cues
              </p>
              <MoreList
                items={topical}
                limit={4}
                className="space-y-2"
                render={(s, i) => (
                  <Link key={i} href={`/brief/${s.signal.slug}?story=${s.signal.storyIndex + 1}`}
                    className="block rounded-lg border border-border/40 bg-[var(--color-ink-well)] hover:border-[var(--color-amber)]/40 transition-colors p-3">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>{s.signal.text}</p>
                    <div className="flex items-center gap-2 mt-2 text-[11px]">
                      <span className="font-semibold tracking-[0.1em] uppercase" style={{ color: CATEGORY_COLORS[s.signal.category] ?? "var(--color-mist-faint)" }}>
                        {s.signal.category.replace("-", " ")}
                      </span>
                      <span className="font-mono ml-auto" style={{ color: "var(--color-mist-faint)" }}>{shortDate(s.signal.date)}</span>
                    </div>
                  </Link>
                )}
              />
            </div>
          )}

          {/* When there are no bound signals, still make the expand worthwhile:
              point the reader at the per-reading stories on the chart. */}
          {realised.length === 0 && watching.length === 0 && topical.length === 0 && (
            <div className="border-t border-border/40 px-4 py-4">
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-mist-faint)" }}>
                No flagged signals for this metric yet — hover a point on the chart to read that day's brief.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
