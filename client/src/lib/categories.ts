/**
 * Category mapping — ONE source of truth for a story category's icon, colour,
 * and display label, reused across Today's Brief, the Story page, Signals, and
 * About (UX-revamp punch-list item 8: "Define the category tag/icon-color
 * mapping once, reuse it everywhere it appears").
 *
 * Colours resolve to the shared `--color-cat-*` CSS variables, which are already
 * tuned per theme band in index.css — so callers never hard-code a colour.
 */

import {
  Globe,
  Scale,
  CandlestickChart,
  Briefcase,
  Cpu,
  FlaskConical,
  HeartPulse,
  Drama,
  Landmark,
  Link2,
  Newspaper,
  type LucideIcon,
} from "lucide-react";

interface CategoryMeta {
  icon: LucideIcon;
  /** CSS custom property carrying the category colour for the active theme band. */
  colorVar: string;
  label: string;
}

// Keyed by the category strings the brief data uses (see briefParser
// getCategoryFromSection) plus a few aliases that appear in older briefs.
const CATEGORIES: Record<string, CategoryMeta> = {
  geopolitics: { icon: Scale, colorVar: "var(--color-cat-geopolitics)", label: "Geopolitics" },
  economics: { icon: CandlestickChart, colorVar: "var(--color-cat-economics)", label: "Economics" },
  markets: { icon: CandlestickChart, colorVar: "var(--color-cat-markets)", label: "Markets" },
  business: { icon: Briefcase, colorVar: "var(--color-cat-economics)", label: "Business" },
  "ai-tech": { icon: Cpu, colorVar: "var(--color-cat-tech)", label: "AI & Tech" },
  tech: { icon: Cpu, colorVar: "var(--color-cat-tech)", label: "AI & Tech" },
  science: { icon: FlaskConical, colorVar: "var(--color-cat-science)", label: "Science" },
  health: { icon: HeartPulse, colorVar: "var(--color-cat-science)", label: "Science & Health" },
  culture: { icon: Drama, colorVar: "var(--color-cat-culture)", label: "Culture" },
  singapore: { icon: Landmark, colorVar: "var(--color-cat-singapore)", label: "Singapore" },
  systems: { icon: Link2, colorVar: "var(--color-cat-tech)", label: "Synthesis" },
};

const FALLBACK: CategoryMeta = {
  icon: Newspaper,
  colorVar: "var(--color-mist-dim)",
  label: "News",
};

// The lead story (section 1) is presented as the day's lead regardless of its
// underlying category — its own accent is the brand cyan.
const LEAD: CategoryMeta = { icon: Globe, colorVar: "var(--color-cyan)", label: "Lead story" };

function metaFor(category: string): CategoryMeta {
  return CATEGORIES[(category ?? "").toLowerCase()] ?? FALLBACK;
}

export function categoryIcon(category: string, isLead = false): LucideIcon {
  return isLead ? LEAD.icon : metaFor(category).icon;
}

/** A `var(--color-cat-*)` string for the active theme band. */
export function categoryColor(category: string, isLead = false): string {
  return isLead ? LEAD.colorVar : metaFor(category).colorVar;
}

export function categoryLabel(category: string, isLead = false): string {
  return isLead ? LEAD.label : metaFor(category).label;
}
