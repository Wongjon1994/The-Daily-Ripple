/**
 * About page — the landing page for first-time visitors (see App.tsx Home).
 * Editorial layout consistent with the brief: Playfair headings, gold/cyan
 * accents, a section grid mirroring the daily brief, and interactive nav cards.
 */

import { Link } from "wouter";
import {
  ArrowRight, BookOpen, TrendingUp, CalendarDays, Sparkles, ShieldAlert,
} from "lucide-react";
import MastheadBanner from "@/components/MastheadBanner";

const SERIF = "'Playfair Display', Georgia, serif";

/** The eight things every brief covers — mirrors the daily deck. */
const COVERAGE = [
  { emoji: "🌐", label: "Lead story", color: "var(--color-cyan)" },
  { emoji: "⚖️", label: "Global politics & policy", color: "var(--color-cat-geopolitics)" },
  { emoji: "📊", label: "Markets", color: "var(--color-cat-economics)" },
  { emoji: "💼", label: "Business", color: "var(--color-cat-economics)" },
  { emoji: "🤖", label: "Technology & the future of work", color: "var(--color-cat-tech)" },
  { emoji: "🔬", label: "Science & health", color: "var(--color-cat-science)" },
  { emoji: "🎭", label: "Culture", color: "var(--color-cat-culture)" },
  { emoji: "🔗", label: "Systems Synthesis", color: "var(--color-cat-science)" },
];

const NAV_CARDS = [
  {
    href: "/", icon: BookOpen, title: "Today's Brief", color: "var(--color-cyan)",
    body: "Where you start. The “at a glance” grid up top summarises all eight stories — tap any box to jump straight to it. From there, swipe, drag, or use your arrow keys to move between stories, each opening into the full analysis, the Singapore-specific lens, and every source we used.",
  },
  {
    href: "/trends", icon: TrendingUp, title: "Trends", color: "var(--color-cat-economics)",
    body: "Live markets, and where we hold ourselves accountable. Real-time charts track equity indices, FX, rates and commodities; and every time a brief flags a level worth watching — an oil price, a rate, an index threshold — we resolve it against the actual numbers and show whether it played out, and how long it took.",
  },
  {
    href: "/calendar", icon: CalendarDays, title: "Archive", color: "var(--color-cat-science)",
    body: "Browse any past brief by date, on a simple calendar.",
  },
];

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="mb-5">
      <div className="h-[2px] w-9 rounded-full mb-3" style={{ background: color, opacity: 0.8 }} />
      <h2 className="text-2xl sm:text-3xl font-bold leading-tight" style={{ fontFamily: SERIF, color: "var(--color-mist)" }}>
        {children}
      </h2>
    </div>
  );
}

const para = "text-[15px] sm:text-base leading-7";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <MastheadBanner />

      <main className="container py-10 sm:py-14">
        <article className="max-w-2xl mx-auto">
          {/* ── Hero ───────────────────────────────────────────────────────── */}
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3" style={{ color: "var(--color-cyan)" }}>
            About
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] mb-4" style={{ fontFamily: SERIF, color: "var(--color-mist)" }}>
            The Daily Ripple
          </h1>
          <p className="text-lg sm:text-xl leading-relaxed mb-7" style={{ color: "var(--color-gold-rich)", fontFamily: SERIF }}>
            A daily intelligence brief for Singapore professionals who want to understand the
            world — and what it actually means here.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            style={{
              color: "var(--color-cyan)",
              border: "1px solid color-mix(in oklab, var(--color-cyan) 45%, transparent)",
              background: "color-mix(in oklab, var(--color-cyan) 10%, transparent)",
            }}
          >
            Start reading today's brief
            <ArrowRight className="h-4 w-4" />
          </Link>

          {/* ── What this is ───────────────────────────────────────────────── */}
          <section className="mt-14">
            <SectionHeader color="var(--color-gold-rich)">What this is</SectionHeader>

            <p className={para} style={{ color: "var(--color-mist-dim)" }}>
              Every Monday to Saturday, we cover eight things — the lead story, global politics and policy,
              markets, business, technology and the future of work, science and health, culture,
              and a closing "Systems Synthesis" that connects the day's stories in a way the
              headlines alone won't show you.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-6">
              {COVERAGE.map((c, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-card px-3 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg leading-none">{c.emoji}</span>
                    <span className="text-[10px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="text-xs font-semibold leading-snug tracking-[0.02em]" style={{ color: c.color }}>
                    {c.label}
                  </div>
                </div>
              ))}
            </div>

            <p className={para} style={{ color: "var(--color-mist-dim)" }}>
              Every section comes back to the same place: what does this mean if you live in
              Singapore, hold a mix of local and international investments, have a mortgage, and are
              trying to make sense of a world that moves faster than most people have time to read
              about.
            </p>

            <blockquote
              className="my-7 pl-4 border-l-[3px] text-xl sm:text-2xl leading-snug"
              style={{ borderColor: "var(--color-cyan)", fontFamily: SERIF, color: "var(--color-mist)" }}
            >
              So what does this mean for me, here?
            </blockquote>

            <p className={para} style={{ color: "var(--color-mist-dim)" }}>
              We built this because reading the news properly — across a dozen sources, every
              morning — was taking 30 to 45 minutes and still left the most important question
              unanswered. The Daily Ripple is our attempt to close that gap.
            </p>
          </section>

          {/* ── How to navigate ────────────────────────────────────────────── */}
          <section className="mt-14">
            <SectionHeader color="var(--color-cyan)">How to navigate the site</SectionHeader>

            <div className="grid sm:grid-cols-3 gap-3">
              {NAV_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.href}
                    href={card.href}
                    className="group block rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-[var(--color-cyan)]/40"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-5 w-5 shrink-0" style={{ color: card.color }} />
                      <span className="font-semibold" style={{ fontFamily: SERIF, color: "var(--color-mist)" }}>
                        {card.title}
                      </span>
                      <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: card.color }} />
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>
                      {card.body}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* ── How it's made + limits ─────────────────────────────────────── */}
          <section className="mt-14">
            <SectionHeader color="var(--color-cat-science)">
              A note on how this is made — and its limits
            </SectionHeader>

            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-4"
              style={{
                color: "var(--color-cyan)",
                border: "1px solid color-mix(in oklab, var(--color-cyan) 40%, transparent)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold tracking-[0.04em]">Written by Claude · Anthropic</span>
            </div>

            <div className="space-y-4">
              <p className={para} style={{ color: "var(--color-mist-dim)" }}>
                The Daily Ripple is written by Claude, an AI model from Anthropic, using a detailed
                system we've built to define its voice, sourcing standards, and analytical
                framework. We design the structure, the editorial rules, and the Singapore-specific
                lens. The AI researches, writes, and synthesises within that framework, drawing only
                from a defined list of credible news sources.
              </p>
              <p className={para} style={{ color: "var(--color-mist-dim)" }}>
                This means the brief is fast, consistent, and able to draw connections across a wide
                range of stories every single day — something no individual reader has time to do
                alone. It also means you should read it the way you'd read any analysis: as a
                well-researched, carefully reasoned perspective, not as financial advice or verified
                fact in every detail.
              </p>
              <p className={para} style={{ color: "var(--color-mist-dim)" }}>
                We take source accuracy seriously — every claim in the brief is tied to a named,
                linked source, and every link is checked for whether it actually works. But
                AI-generated analysis can occasionally misstate a detail, draw an imperfect
                inference, or miss context a human editor would have caught. If something looks off,
                we want to know — and we correct mistakes publicly when they happen.
              </p>
            </div>

            {/* Disclaimer callout */}
            <div
              className="rounded-lg border-l-[3px] p-4 mt-6"
              style={{
                borderColor: "var(--color-amber)",
                background: "color-mix(in oklab, var(--color-amber) 8%, transparent)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="h-4 w-4 shrink-0" style={{ color: "var(--color-amber)" }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-amber)" }}>
                  This is not financial advice
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-mist-dim)" }}>
                Nothing in The Daily Ripple should be read as a recommendation to buy, sell, or hold
                any investment. We talk about how global events connect to Singapore's markets,
                institutions, and your own financial life — but the decisions are yours, and you
                should make them with your own judgement, or with a licensed financial adviser if
                you need one.
              </p>
            </div>
          </section>

          {/* ── Footer note ────────────────────────────────────────────────── */}
          <div className="mt-14 pt-6 border-t border-border/40 text-center">
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-mist-faint)" }}>
              The Daily Ripple is an independent, self-funded project, currently free to read, and
              still very much a work in progress.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 mt-5 text-sm font-semibold transition-colors hover:gap-3"
              style={{ color: "var(--color-cyan)" }}
            >
              Start reading today's brief
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
