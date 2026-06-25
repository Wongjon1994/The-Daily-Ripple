/**
 * BriefBento — an editorial "at a glance" summary that sits above the reading deck.
 *
 * Construction borrows from the print masthead: an asymmetric magazine grid with a
 * large lead-story cell (section 1), medium cells (2–3), a four-across strip (4–7),
 * and a full-width System Synthesis footer (section 8). Each cell links into the deck.
 *
 * Rather than echoing each headline, a cell distills the section to a tight topic
 * line plus its most telling figure — a key-metric chip when the section carries
 * structured metrics, and numerals emphasised inline in the supporting dek.
 *
 * The bento grid is the default at every width: a 2-column bento on narrow screens,
 * the 4-column magazine grid from `sm` up. It never collapses to a single stack.
 */

import { useState, Fragment } from "react";
import type { BriefSection, DailyBrief, KeyMetric } from "@/lib/briefParser";
import { isSynthesisSection } from "@/lib/trendsAnalysis";
import { cn } from "@/lib/utils";
import {
  Globe,
  Scale,
  CandlestickChart,
  Briefcase,
  Cpu,
  FlaskConical,
  Drama,
  Landmark,
  HeartPulse,
  Newspaper,
  Star,
  Link2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface BriefBentoProps {
  brief: DailyBrief;
  /** Jump the deck to a given absolute section index. */
  onSelectSection: (index: number) => void;
}

// Category → line icon, mirroring the print brief's iconography.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  geopolitics: Globe,
  economics: CandlestickChart,
  markets: CandlestickChart,
  business: Briefcase,
  "ai-tech": Cpu,
  tech: Cpu,
  science: FlaskConical,
  health: HeartPulse,
  culture: Drama,
  singapore: Landmark,
  systems: Link2,
};

function iconFor(category: string): LucideIcon {
  return CATEGORY_ICON[category.toLowerCase()] ?? Newspaper;
}

/** Decode the handful of HTML entities that leak through from imported briefs. */
function decode(s: string): string {
  return (s || "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}

// Trailing words we don't want a truncated title to end on (reads as a dangling fragment).
const TRAILING_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "as", "for",
  "with", "by", "from", "into", "over", "after", "amid", "is", "are", "its",
]);

/**
 * A clean cell title: the lead clause of a two-part headline (before ";"/"—"),
 * then a word-boundary truncation to `max` chars so it never cuts mid-word — and
 * trailing connectives ("…leaders in") are dropped so it ends on a real phrase.
 */
function tidyTitle(headline: string, max: number): string {
  const h = decode(headline).trim();
  const lead = h.split(/\s*[;–—]\s+/)[0];
  const base = lead.length >= 12 ? lead : h;
  if (base.length <= max) return base;

  let cut = base.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  let words = cut.split(/\s+/);
  while (words.length > 1 && TRAILING_STOPWORDS.has(words[words.length - 1].toLowerCase().replace(/[^a-z]/gi, ""))) {
    words.pop();
  }
  return words.join(" ").replace(/[,;:.\s]+$/, "") + "…";
}

/** The category label above each headline; the lead story is labelled as such. */
function labelFor(section: BriefSection, isLead: boolean): string {
  if (isLead) return "Lead Story";
  const c = section.category.toLowerCase();
  if (c === "ai-tech" || c === "tech") return "AI & Tech";
  if (c === "systems") return "Synthesis";
  return section.category.charAt(0).toUpperCase() + section.category.slice(1);
}

// Numeric tokens we treat as "key stats" worth emphasising: currency, percentages,
// scaled counts, basis points, ages. Deliberately excludes bare integers/years.
const STAT_TOKEN =
  /(\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|trillion|bn|m))?|\d+(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\s?(?:billion|million|trillion|basis points|bps)\b|\b\d{2,3}-year-old\b)/gi;

/** Pick the section's most telling structured metric (a real value, not a placeholder). */
function leadMetric(metrics: KeyMetric[] | undefined): KeyMetric | null {
  if (!metrics?.length) return null;
  const real = (v?: string) => !!v && v.trim() !== "" && v.trim() !== "—";
  return metrics.find((m) => real(m.value)) ?? metrics.find((m) => real(m.change)) ?? null;
}

/** Prefer the first sentence that carries a figure; fall back to the opening sentence. */
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

/** Render a dek with its key figures emphasised in gold. */
function StatDek({ section, max }: { section: BriefSection; max: number }) {
  const text = distillDek(section, max);
  if (!text) return null;
  STAT_TOKEN.lastIndex = 0;
  const parts = text.split(STAT_TOKEN);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="font-semibold" style={{ color: "var(--color-gold-rich)" }}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

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
        <span className="font-bold" style={{ color: "var(--color-gold-soft)", fontFamily: "var(--font-display)" }}>
          {metric.value}
        </span>
      )}
      {metric.change && (
        <span style={{ color: "var(--color-mist-dim)" }}>
          {arrow} {metric.change}
        </span>
      )}
      <span className="uppercase tracking-[0.08em] text-[10px]" style={{ color: "var(--color-mist-faint)" }}>
        {decode(metric.label)}
      </span>
    </span>
  );
}

interface CellProps {
  section: BriefSection;
  index: number;
  variant: "hero" | "medium" | "small";
  isLead: boolean;
  onSelect: (index: number) => void;
}

function BentoCell({ section, index, variant, isLead, onSelect }: CellProps) {
  const Icon = isLead ? Star : iconFor(section.category);
  const metric = variant === "small" ? null : leadMetric(section.keyMetrics);
  const headlineSize =
    variant === "hero"
      ? "text-[clamp(1.65rem,3vw,2.4rem)] leading-[1.05]"
      : variant === "medium"
      ? "text-lg sm:text-xl leading-[1.12]"
      : "text-base leading-[1.15]";
  const clamp = variant === "hero" ? "line-clamp-3" : variant === "medium" ? "line-clamp-4" : "line-clamp-3";
  const titleCap = variant === "hero" ? 62 : variant === "medium" ? 52 : 40;

  return (
    <button
      onClick={() => onSelect(index)}
      className={cn(
        "group relative flex flex-col text-left rounded-lg p-3.5 h-full w-full",
        "border border-border/50 transition-colors hover:border-[var(--color-gold-rich)]/55"
      )}
      style={{ background: "color-mix(in oklab, var(--card) 88%, transparent)" }}
    >
      <Icon
        className="absolute top-3 right-3 h-[18px] w-[18px] opacity-60 transition-opacity group-hover:opacity-90"
        style={{ color: "var(--color-gold-rich)" }}
      />
      <span
        className="text-[10px] font-mono uppercase tracking-[0.13em] mb-1.5 pr-7"
        style={{ color: "var(--color-mist-faint)" }}
      >
        <span style={{ color: "var(--color-gold-rich)" }}>{String(Number(section.id)).padStart(2, "0")}</span>{" "}
        {labelFor(section, isLead)}
      </span>
      <span
        className={cn("font-bold pr-6", headlineSize, clamp)}
        style={{ fontFamily: "var(--font-display)", color: "var(--color-gold-soft)" }}
      >
        {tidyTitle(section.headline, titleCap)}
      </span>
      {metric && (
        <span className="mt-2.5">
          <MetricChip metric={metric} />
        </span>
      )}
      <span
        className={cn("text-xs leading-snug pt-2 line-clamp-2", variant === "hero" ? "mt-auto" : "mt-1")}
        style={{ color: "var(--color-mist-dim)" }}
      >
        <StatDek section={section} max={variant === "hero" ? 130 : variant === "medium" ? 88 : 66} />
      </span>
    </button>
  );
}

function SynthesisCell({ section, index, onSelect }: { section: BriefSection; index: number; onSelect: (i: number) => void }) {
  return (
    <button
      onClick={() => onSelect(index)}
      className={cn(
        "group flex items-center gap-3.5 rounded-lg p-3.5 text-left w-full h-full",
        "border transition-colors hover:border-[var(--color-gold-rich)]/55"
      )}
      style={{
        background: "color-mix(in oklab, var(--card) 70%, transparent)",
        borderColor: "color-mix(in oklab, var(--color-gold-rich) 32%, var(--border))",
      }}
    >
      <Link2 className="h-5 w-5 shrink-0" style={{ color: "var(--color-gold-rich)" }} />
      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-mono uppercase tracking-[0.13em] mb-0.5" style={{ color: "var(--color-mist-faint)" }}>
          <span style={{ color: "var(--color-gold-rich)" }}>08</span> Synthesis
        </span>
        <span className="block text-base sm:text-lg font-bold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-gold-soft)" }}>
          System Synthesis
        </span>
        <span className="block text-xs leading-snug mt-0.5 line-clamp-2 sm:line-clamp-1" style={{ color: "var(--color-mist-dim)" }}>
          <StatDek section={section} max={150} />
        </span>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--color-mist-faint)" }} />
    </button>
  );
}

export default function BriefBento({ brief, onSelectSection }: BriefBentoProps) {
  const [open, setOpen] = useState(true);

  const indexed = brief.sections.map((section, index) => ({ section, index }));
  const synth = indexed.find((s) => isSynthesisSection(s.section));
  const stories = indexed.filter((s) => !isSynthesisSection(s.section));
  if (stories.length === 0) return null;

  const handleSelect = (index: number) => {
    // The page owns navigation + scroll (it hides the bento and focuses the deck).
    onSelectSection(index);
  };

  const [hero, ...rest] = stories;
  const isCanonical = rest.length === 6;
  const areas = ["s2", "s3", "s4", "s5", "s6", "s7"];

  return (
    <section aria-label="Today's brief at a glance" className="w-full">
      <style>{`
        .rb-grid{display:grid;gap:8px;grid-template-columns:repeat(2,1fr);grid-auto-rows:auto;
          grid-template-areas:"s1 s1" "s2 s3" "s4 s5" "s6 s7" "s8 s8";}
        @media(min-width:640px){.rb-grid{grid-template-columns:repeat(4,1fr);
          grid-template-areas:"s1 s1 s2 s2" "s1 s1 s3 s3" "s4 s5 s6 s7" "s8 s8 s8 s8";}}
        .rb-grid>*{min-width:0;}
      `}</style>

      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base font-bold tracking-[0.02em]" style={{ fontFamily: "var(--font-display)", color: "var(--color-gold-rich)" }}>
          Today&apos;s brief at a glance
        </h2>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 border border-border/50 transition-colors hover:border-[var(--color-gold-rich)]/45"
          style={{ color: "var(--color-mist-dim)" }}
        >
          {open ? "Collapse" : "Expand"}
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {open &&
        (isCanonical ? (
          <div className="rb-grid">
            <div style={{ gridArea: "s1" }}>
              <BentoCell section={hero.section} index={hero.index} variant="hero" isLead onSelect={handleSelect} />
            </div>
            {rest.map((s, i) => (
              <div key={s.index} style={{ gridArea: areas[i] }}>
                <BentoCell
                  section={s.section}
                  index={s.index}
                  variant={i < 2 ? "medium" : "small"}
                  isLead={false}
                  onSelect={handleSelect}
                />
              </div>
            ))}
            {synth && (
              <div style={{ gridArea: "s8" }}>
                <SynthesisCell section={synth.section} index={synth.index} onSelect={handleSelect} />
              </div>
            )}
          </div>
        ) : (
          // Fallback for non-canonical briefs: a uniform responsive bento.
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
            <BentoCell section={hero.section} index={hero.index} variant="medium" isLead onSelect={handleSelect} />
            {rest.map((s) => (
              <BentoCell key={s.index} section={s.section} index={s.index} variant="small" isLead={false} onSelect={handleSelect} />
            ))}
            {synth && <SynthesisCell section={synth.section} index={synth.index} onSelect={handleSelect} />}
          </div>
        ))}
    </section>
  );
}
