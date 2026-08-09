/**
 * TodayBriefList — the canonical Today's Brief view (UX-revamp §6.1).
 *
 * One structure, three densities (nothing is added or removed between them):
 *   • mobile  — a single column: a prominent lead card, then compact rows for
 *     the remaining stories, then a distinctly-tinted System Synthesis card.
 *   • tablet  — lead full-width; secondary stories in a 2-column card grid.
 *   • desktop — secondary stories in a 3–4 column grid.
 *
 * DOM order stays linear (lead → 2 → 3 … → synthesis) at every width, so screen
 * readers get a sane sequence even when the visual layout is a grid (§8).
 *
 * Every item links to the dedicated Story page (/brief/:slug/:story). This
 * replaces both the old "at a glance" bento AND the duplicate swipe carousel.
 */

import { Fragment } from "react";
import { Link } from "wouter";
import type { BriefSection, DailyBrief, KeyMetric } from "@/lib/briefParser";
import { isSynthesisSection } from "@/lib/trendsAnalysis";
import { categoryIcon, categoryColor, categoryLabel } from "@/lib/categories";
import { Link2, Clock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Decode the handful of HTML entities that leak through from imported briefs. */
function decode(s: string): string {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

// Numeric tokens worth emphasising: currency, percentages, scaled counts, bps.
const STAT_TOKEN =
  /(\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|trillion|bn|m))?|\d+(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\s?(?:billion|million|trillion|basis points|bps)\b|\b\d{2,3}-year-old\b)/gi;

function leadMetric(metrics: KeyMetric[] | undefined): KeyMetric | null {
  if (!metrics?.length) return null;
  const real = (v?: string) => !!v && v.trim() !== "" && v.trim() !== "—";
  return metrics.find((m) => real(m.value)) ?? metrics.find((m) => real(m.change)) ?? null;
}

/** Prefer the first sentence carrying a figure; fall back to the opening sentence. */
function distillDek(section: BriefSection, max: number): string {
  const text = decode([section.summary, section.paragraphs?.[0]].filter(Boolean).join(" ")).trim();
  if (!text) return "";
  const sentences = text.split(/(?<=[.?!])\s+/);
  STAT_TOKEN.lastIndex = 0;
  const withStat = sentences.find((s) => STAT_TOKEN.test(s));
  STAT_TOKEN.lastIndex = 0;
  const base = withStat ?? sentences[0] ?? text;
  if (base.length <= max) return base.replace(/[…\s]+$/, "");
  return base.slice(0, max).replace(/\s+\S*$/, "").replace(/[…,;:\s]+$/, "") + "…";
}

/** A dek with its key figures emphasised in gold. */
function StatDek({ section, max, className }: { section: BriefSection; max: number; className?: string }) {
  const text = distillDek(section, max);
  if (!text) return null;
  STAT_TOKEN.lastIndex = 0;
  const parts = text.split(STAT_TOKEN);
  return (
    <span className={className} style={{ color: "var(--color-mist-dim)" }}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold" style={{ color: "var(--color-gold-rich)" }}>{part}</span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </span>
  );
}

/** Compact stat chip — the section's most telling structured metric, if any. */
function MetricChip({ metric }: { metric: KeyMetric }) {
  const arrow = metric.direction === "up" ? "▲" : metric.direction === "down" ? "▼" : "";
  const hasValue = metric.value && metric.value.trim() !== "—";
  return (
    <span
      className="inline-flex items-baseline gap-1.5 rounded px-2 py-1 text-xs"
      style={{
        background: "color-mix(in oklab, var(--color-gold-rich) 12%, transparent)",
        border: "0.5px solid color-mix(in oklab, var(--color-gold-rich) 30%, transparent)",
      }}
    >
      {hasValue && (
        <span className="font-bold font-mono" style={{ color: "var(--color-gold-soft)" }}>{metric.value}</span>
      )}
      {metric.change && <span style={{ color: "var(--color-mist-dim)" }}>{arrow} {metric.change}</span>}
      <span className="uppercase tracking-[0.08em] text-[10px]" style={{ color: "var(--color-mist-faint)" }}>
        {decode(metric.label)}
      </span>
    </span>
  );
}

function Eyebrow({ section, isLead }: { section: BriefSection; isLead: boolean }) {
  const color = categoryColor(section.category, isLead);
  return (
    <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.13em]">
      <span style={{ color: "var(--color-mist-faint)" }}>{String(Number(section.id)).padStart(2, "0")}</span>
      <span style={{ color }}>{categoryLabel(section.category, isLead)}</span>
    </span>
  );
}

function LeadCard({ section, href }: { section: BriefSection; href: string }) {
  const Icon = categoryIcon(section.category, true);
  const color = categoryColor(section.category, true);
  const metric = leadMetric(section.keyMetrics);
  const outlets = section.sources?.map((s) => s.outlet).filter(Boolean) ?? [];
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border/60 bg-card p-5 sm:p-6 transition-colors hover:border-[var(--color-cyan)]/45"
    >
      <div className="flex items-center justify-between mb-3">
        {/* Filled "Lead story" pill — the day's lead reads at a glance (mockups). */}
        <span
          className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em]"
          style={{
            color: "var(--color-gold-rich)",
            background: "color-mix(in oklab, var(--color-gold-rich) 15%, transparent)",
          }}
        >
          Lead story
        </span>
        <Icon className="h-[18px] w-[18px] shrink-0" style={{ color }} />
      </div>
      <h2
        className="font-bold leading-[1.08] text-[clamp(1.5rem,4.5vw,2rem)] mb-3"
        style={{ fontFamily: "var(--font-display)", color: "var(--color-mist)" }}
      >
        {decode(section.headline)}
      </h2>
      <StatDek section={section} max={150} className="block text-[15px] leading-relaxed mb-3" />
      <div className="flex items-center gap-3 flex-wrap">
        {metric && <MetricChip metric={metric} />}
        {outlets.length > 0 && (
          <span className="text-[11px] font-mono truncate" style={{ color: "var(--color-mist-faint)" }}>
            via {outlets.join(", ")}
          </span>
        )}
        <span
          className="ml-auto flex items-center gap-1 text-xs font-semibold shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
          style={{ color: "var(--color-cyan)" }}
        >
          Read <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

/** A story item: a compact row on mobile, a vertical card in the grid (≥640px). */
function StoryItem({ section, href }: { section: BriefSection; href: string }) {
  const Icon = categoryIcon(section.category);
  const color = categoryColor(section.category);
  const readingTime = section.readingTime;
  const outlets = section.sources?.map((s) => s.outlet).filter(Boolean) ?? [];
  const meta = [outlets.slice(0, 2).join(", "), `${readingTime}m`].filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      className={cn(
        "group flex sm:flex-col gap-3 sm:gap-2.5 rounded-xl border border-border/50 p-3.5 sm:p-4 h-full",
        "transition-colors hover:border-[var(--color-cyan)]/45"
      )}
      style={{ background: "color-mix(in oklab, var(--card) 88%, transparent)" }}
    >
      {/* Icon — leads the row on mobile, sits above on cards */}
      <span
        className="shrink-0 grid place-items-center h-9 w-9 sm:h-8 sm:w-8 rounded-lg"
        style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <Eyebrow section={section} isLead={false} />
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono shrink-0" style={{ color: "var(--color-mist-faint)" }}>
            <Clock className="h-3 w-3" />{readingTime}m
          </span>
        </div>
        <h3
          className="font-bold leading-[1.15] text-[15px] sm:text-base line-clamp-2 sm:line-clamp-3"
          style={{ fontFamily: "var(--font-display)", color: "var(--color-mist)" }}
        >
          {decode(section.headline)}
        </h3>
        {/* Dek — shown as a card (≥640px); rows stay to a one-line meta on mobile */}
        <StatDek section={section} max={90} className="hidden sm:block text-[13px] leading-snug mt-1.5 line-clamp-2" />
        {/* One-line meta: source · reading time (mockup §6.1) */}
        <p className="text-[11px] font-mono truncate mt-1.5 sm:mt-2" style={{ color: "var(--color-mist-faint)" }}>
          {meta}
        </p>
      </div>
    </Link>
  );
}

function SynthesisCard({ section, href }: { section: BriefSection; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-xl p-4 sm:p-5 border transition-colors hover:border-[var(--color-gold-rich)]/55"
      style={{
        // Distinct tint so synthesis reads as analysis, not another headline (§6.1).
        background: "color-mix(in oklab, var(--color-gold-rich) 8%, var(--card))",
        borderColor: "color-mix(in oklab, var(--color-gold-rich) 32%, var(--border))",
      }}
    >
      <span
        className="shrink-0 grid place-items-center h-10 w-10 rounded-lg"
        style={{ color: "var(--color-gold-rich)", background: "color-mix(in oklab, var(--color-gold-rich) 14%, transparent)" }}
      >
        <Link2 className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-mono uppercase tracking-[0.13em] mb-0.5" style={{ color: "var(--color-mist-faint)" }}>
          <span style={{ color: "var(--color-gold-rich)" }}>08</span> Synthesis
        </span>
        <span className="block text-base sm:text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-gold-soft)" }}>
          System Synthesis
        </span>
        <StatDek section={section} max={150} className="block text-[13px] leading-snug mt-0.5 line-clamp-2" />
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--color-mist-faint)" }} />
    </Link>
  );
}

export default function TodayBriefList({ brief, slug }: { brief: DailyBrief; slug: string }) {
  const indexed = brief.sections.map((section, index) => ({ section, index }));
  const synth = indexed.find((s) => isSynthesisSection(s.section));
  const stories = indexed.filter((s) => !isSynthesisSection(s.section));
  if (stories.length === 0) return null;

  const [hero, ...rest] = stories;
  const storyHref = (index: number) => `/brief/${slug}/${index + 1}`;

  return (
    <section aria-label="Today's brief">
      <h2
        className="text-[11px] font-mono uppercase tracking-[0.16em] mb-3"
        style={{ color: "var(--color-mist-faint)" }}
      >
        Today · {brief.date}
      </h2>

      <div className="flex flex-col gap-3 sm:gap-4">
        <LeadCard section={hero.section} href={storyHref(hero.index)} />

        {rest.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rest.map(({ section, index }) => (
              <StoryItem key={index} section={section} href={storyHref(index)} />
            ))}
          </div>
        )}

        {synth && <SynthesisCard section={synth.section} href={storyHref(synth.index)} />}
      </div>
    </section>
  );
}
