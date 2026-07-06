/**
 * Trends Dashboard (Part 2). Live markets, then the qualitative intelligence
 * layer: a Dominant Signal hero and a grid of active theme cards, built from the
 * persisted signal ledger and enriched with pre-generated synthesis prose.
 *
 * All shaping lives in lib/trendsView.ts; this file only renders. Reference
 * design: trends_mockup.html, re-grounded in the live Daily Ripple tokens.
 */

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import type { DailyBrief } from "@/lib/briefParser";
import {
  buildTrendsView,
  type SignalRow,
  type ThemeInsightRow,
  type ThemeView,
} from "@/lib/trendsView";
import MarketsSection from "@/components/MarketsSection";
import {
  ChevronDown, CircleCheck, Telescope, Flame, Landmark, Cpu, Shield,
  TrendingUp, Users, Sparkles, Activity, ArrowUpRight, Info,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type TrendsWindow = "1W" | "1M" | "3M";

const THEME_META: Record<string, { label: string; Icon: typeof Flame; color: string }> = {
  geopolitics: { label: "Geopolitics & Security", Icon: Shield, color: "var(--color-cat-geopolitics)" },
  ai_tech: { label: "AI & Technology", Icon: Cpu, color: "var(--color-cyan)" },
  society: { label: "Society & Culture", Icon: Users, color: "var(--color-cat-culture)" },
  rates: { label: "Rates & Banking", Icon: Landmark, color: "var(--color-cat-tech)" },
  markets: { label: "Markets & Corporate", Icon: TrendingUp, color: "var(--color-cat-science)" },
  energy: { label: "Energy & Commodities", Icon: Flame, color: "var(--color-cat-economics)" },
  other: { label: "Other Signals", Icon: Telescope, color: "var(--color-mist-faint)" },
};
const meta = (theme: string) => THEME_META[theme] ?? THEME_META.other;
const REALISED = "var(--color-cat-markets)";

const WINDOWS: { key: TrendsWindow; label: string; days: number | "week" }[] = [
  { key: "1W", label: "1W", days: "week" },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
];

// ── date helpers ─────────────────────────────────────────────────────────────
const iso = (date: string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortIso = (s: string) => {
  const [, m, d] = s.split("-");
  return m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}` : s;
};

/** Distinct brief dates (ISO) within the selected window. */
function windowDatesFor(briefs: Record<string, DailyBrief>, window: TrendsWindow): string[] {
  const all = Array.from(new Set(Object.values(briefs).map((b) => iso(b.date)).filter(Boolean))).sort();
  // Briefs publish Mon–Sat, so one publishing week is 6 briefs (not 7).
  if (window === "1W") return all.slice(-6);
  const days = window === "1M" ? 30 : 90;
  const newest = all[all.length - 1];
  if (!newest) return [];
  const cutoff = new Date(newest);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return all.filter((d) => d >= cutoffIso);
}

/** Trim to a word boundary with an ellipsis — a safe collapsed preview that
 *  doesn't rely on -webkit-line-clamp (which over-reserves height on iOS). */
function clip(text: string, n = 165): string {
  if (text.length <= n) return text;
  return text.slice(0, n).replace(/\s+\S*$/, "") + "…";
}

/** First sentence of the hero narrative → a headline; falls back to the top signal. */
function heroHeadline(view: ThemeView): string {
  const src = view.heroNarrative || view.signals[0]?.signalText || meta(view.theme).label;
  const first = src.split(/(?<=[.!?])\s/)[0].trim();
  return first.length > 120 ? `${first.slice(0, 117).trimEnd()}…` : first;
}

/** Tap/hover explainer for the Intelligence signals section (works on touch). */
function InfoTip() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="How intelligence signals work"
          className="shrink-0 grid place-items-center h-5 w-5 rounded-full border border-border/60 transition-colors hover:text-[var(--color-cyan)] hover:border-[var(--color-cyan)]"
          style={{ color: "var(--color-mist-faint)" }}
        >
          <Info className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-72 p-3.5">
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--color-cyan)" }}>
          How this works
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>
          Each weekday brief ends with forward-looking “watch” signals. We extract them,
          group by theme, and track how many of the recent briefs each theme appears in.
          The hero is the window’s most persistent theme; every card opens to its
          aggregated Singapore Lens and the signals behind it. Open signals are
          re-checked against the news weekly and marked{" "}
          <b style={{ color: "var(--color-cat-markets)" }}>Realised</b> when they come true.
        </p>
      </PopoverContent>
    </Popover>
  );
}

// ── small building blocks ────────────────────────────────────────────────────
function PersistenceDots({ days, color }: { days: ThemeView["days"]; color: string }) {
  return (
    <span className="flex items-center gap-[3px]" aria-hidden="true">
      {days.map((d, i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ background: d.appeared ? color : "var(--border)" }}
        />
      ))}
    </span>
  );
}

function SgLensCallout({ text, compact }: { text: string; compact?: boolean }) {
  if (!text) return null;
  return (
    <div
      className="rounded-r-md"
      style={{
        borderLeft: `${compact ? 2 : 3}px solid var(--color-sage)`,
        background: "color-mix(in oklab, var(--color-sage) 6%, var(--card))",
        padding: compact ? "0.55rem 0.7rem" : "0.75rem 1rem",
      }}
    >
      <div
        className="flex items-center gap-1.5 font-semibold uppercase mb-1"
        style={{ color: "var(--color-sage)", fontSize: compact ? 9 : 10, letterSpacing: "0.1em" }}
      >
        <Sparkles style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }} />
        Singapore Lens
      </div>
      <p className="leading-relaxed" style={{ color: "var(--color-mist-dim)", fontSize: compact ? 12 : 13 }}>
        {text}
      </p>
    </div>
  );
}

function SignalRowItem({ s, color }: { s: SignalRow; color: string }) {
  const realised = s.status === "realised";
  return (
    <Link
      href={`/brief/${s.briefDateSlug}?story=${s.storyIndex + 1}`}
      className="block rounded-md border border-border/50 bg-[var(--color-ink-well)] p-2.5 transition-colors"
      style={{ ["--tw-hover-border" as string]: color }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `color-mix(in oklab, ${color} 45%, transparent)`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
    >
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>{s.signalText}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {realised && (
          <span className="flex items-center gap-1 font-semibold uppercase" style={{ color: REALISED, fontSize: 9, letterSpacing: "0.08em" }}>
            <CircleCheck className="h-3 w-3" />
            Realised{s.realisedDate ? ` ${shortIso(s.realisedDate)}` : ""}
          </span>
        )}
        <span className="font-mono ml-auto flex items-center gap-1" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>
          {shortIso(s.surfacedDate)}
          <ArrowUpRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function MoreList<T>({ items, limit, render }: { items: T[]; limit: number; render: (item: T, i: number) => ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <>
      {shown.map(render)}
      {items.length > limit && (
        <button
          onClick={() => setAll((v) => !v)}
          className="w-full rounded-md border border-dashed border-border py-1.5 font-mono transition-colors hover:border-[var(--color-mist-faint)]"
          style={{ color: "var(--color-mist-faint)", fontSize: 11 }}
        >
          {all ? "Show fewer" : `Show ${items.length - limit} more signal${items.length - limit === 1 ? "" : "s"}`}
        </button>
      )}
    </>
  );
}

// ── hero ─────────────────────────────────────────────────────────────────────
function DominantHero({ view }: { view: ThemeView }) {
  const { color, label } = meta(view.theme);
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 sm:p-7"
      style={{
        border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
        background: `color-mix(in oklab, ${color} 6%, var(--card))`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-3" style={{ color, fontSize: 10, letterSpacing: "0.08em" }}>
        <span className="animate-pulse h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label} · Strongest signal · {view.briefCount} of {view.totalBriefs} briefs
      </div>

      <h3 className="font-bold leading-snug mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)", fontSize: "clamp(1.25rem, 4vw, 1.6rem)" }}>
        {heroHeadline(view)}
      </h3>

      {view.heroNarrative && (
        <p className="leading-relaxed mb-5 max-w-[780px]" style={{ color: "var(--color-mist-dim)", fontSize: 14 }}>
          {view.heroNarrative}
        </p>
      )}

      <div className="flex items-center gap-x-6 gap-y-3 flex-wrap mb-1">
        <span className="font-mono" style={{ color: "var(--color-mist-faint)", fontSize: 11 }}>
          <strong style={{ color, fontSize: 13 }}>{view.briefCount}/{view.totalBriefs}</strong> briefs
        </span>
        <span className="flex items-end gap-[3px] h-6" title="Appearance across recent briefs" aria-hidden="true">
          {view.days.map((d, i) => (
            <span
              key={i}
              className="w-2 rounded-t-sm"
              style={{ height: d.appeared ? 24 : 8, background: d.appeared ? color : "var(--border)", opacity: d.appeared ? 1 : 0.8 }}
            />
          ))}
        </span>
        {view.realisedCount > 0 && (
          <span className="flex items-center gap-1 font-mono" style={{ color: REALISED, fontSize: 11 }}>
            <CircleCheck className="h-3.5 w-3.5" /> {view.realisedCount} realised
          </span>
        )}
      </div>

      {view.sgLens && <div className="mt-4"><SgLensCallout text={view.sgLens} /></div>}
    </div>
  );
}

// ── theme card ───────────────────────────────────────────────────────────────
function ThemeCard({ view }: { view: ThemeView }) {
  const [open, setOpen] = useState(false);
  const { color, label, Icon } = meta(view.theme);
  return (
    <div
      className="rounded-xl border bg-card overflow-hidden transition-colors"
      style={{ borderColor: open ? `color-mix(in oklab, ${color} 40%, transparent)` : "var(--border)" }}
    >
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left px-4 py-3.5">
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className="h-4 w-4 shrink-0" style={{ color }} />
          <span className="font-bold uppercase truncate" style={{ color, fontSize: 12, letterSpacing: "0.05em" }}>{label}</span>
          <span className="ml-auto flex items-center gap-2 font-mono" style={{ color: "var(--color-mist-faint)", fontSize: 10 }}>
            <PersistenceDots days={view.days} color={color} />
            {view.briefCount}/{view.totalBriefs}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </span>
        </div>
        <p className="leading-relaxed" style={{ color: "var(--color-mist-dim)", fontSize: 13 }}>
          {(() => {
            const full = view.themeNarrative || view.signals[0]?.signalText || "";
            return open ? full : clip(full);
          })()}
        </p>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <SgLensCallout text={view.sgLens} compact />
          <div>
            <div className="font-mono font-semibold uppercase mb-2" style={{ color: "var(--color-mist-faint)", fontSize: 10, letterSpacing: "0.08em" }}>
              Evidence trail · {view.signals.length} signal{view.signals.length === 1 ? "" : "s"}
              {view.realisedCount > 0 && <span style={{ color: REALISED }}> · {view.realisedCount} realised</span>}
            </div>
            <div className="space-y-2">
              <MoreList items={view.signals} limit={4} render={(s, i) => <SignalRowItem key={i} s={s} color={color} />} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── page section ─────────────────────────────────────────────────────────────
export default function TrendsDashboard({
  briefs,
  signals,
  insights,
  window,
  onWindowChange,
}: {
  briefs: Record<string, DailyBrief>;
  signals: SignalRow[];
  insights: ThemeInsightRow[];
  window: TrendsWindow;
  onWindowChange: (w: TrendsWindow) => void;
}) {
  const view = useMemo(
    () => buildTrendsView(signals, insights, windowDatesFor(briefs, window)),
    [signals, insights, briefs, window]
  );

  return (
    <div className="space-y-10">
      <MarketsSection briefs={briefs} />

      <section>
        <div
          className="sticky z-20 mb-3 rounded-xl border px-4 sm:px-5 py-2.5 backdrop-blur-md flex flex-col gap-2 sm:flex-row sm:items-center"
          style={{
            top: "calc(var(--nav-h) + 6px)",
            background: "color-mix(in oklab, var(--background) 92%, transparent)",
            borderColor: "var(--card-lift-border)",
            boxShadow: "0 10px 24px -14px rgba(0,0,0,0.5), inset 0 1px 0 0 var(--card-lift-edge)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="h-4 w-4 shrink-0" style={{ color: "var(--color-cyan)" }} />
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-cyan)" }}>
              Intelligence signals
            </h2>
            <InfoTip />
          </div>
          <div className="flex items-center gap-1 sm:ml-auto" role="group" aria-label="Window">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                onClick={() => onWindowChange(w.key)}
                className="rounded-md border px-2.5 py-1 font-mono transition-colors"
                style={
                  window === w.key
                    ? { fontSize: 11, color: "var(--color-cyan)", borderColor: "var(--color-cyan-dim)", background: "color-mix(in oklab, var(--color-cyan) 15%, transparent)" }
                    : { fontSize: 11, color: "var(--color-mist-faint)", borderColor: "var(--border)", background: "transparent" }
                }
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs mb-5 mt-3" style={{ color: "var(--color-mist-faint)" }}>
          Forward-looking signals synthesised across the {window === "1W" ? "past week" : window === "1M" ? "past month" : "past quarter"} of briefs,
          grouped by theme. Themes appearing in 2+ briefs are shown; expand any card for its Singapore Lens and evidence trail.
        </p>

        {view.themes.length === 0 ? (
          <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
            <Telescope className="h-6 w-6 mx-auto mb-3" style={{ color: "var(--color-mist-faint)" }} />
            <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>No persistent themes in this window yet.</p>
            <p className="text-xs mt-1" style={{ color: "var(--color-mist-faint)" }}>
              The intelligence read builds as briefs accumulate — check back after the next few publish.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {view.dominant && <DominantHero view={view.dominant} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {view.themes.map((t) => <ThemeCard key={t.theme} view={t} />)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
