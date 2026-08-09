/**
 * Brief Page — Today's Brief as a single canonical list (UX-revamp §6.1).
 * The old "at a glance" bento + duplicate swipe carousel are gone; each story
 * opens its own dedicated Story page (/brief/:slug/:story). Signals live at
 * /signals; the archive at /calendar.
 */

import { useState, useCallback, useMemo } from "react";
import type { DailyBrief } from "@/lib/briefParser";
import SiteHeader from "@/components/SiteHeader";
import TodayBriefList from "@/components/TodayBriefList";
import WeeklyBriefSelector from "@/components/WeeklyBriefSelector";
import { trpc } from "@/lib/trpc";
import { Loader2, HelpCircle, X, ExternalLink, Send } from "lucide-react";

function rowToBrief(row: any): DailyBrief {
  return {
    date: row.date,
    greeting: row.greeting,
    teaser: Array.isArray(row.teaser) ? row.teaser : [],
    sections: Array.isArray(row.sections) ? row.sections : [],
    systemsSynthesis: row.systemsSynthesis ?? { thesis: "", signals: [] },
  };
}

interface BriefPageEnhancedProps {
  initialSlug?: string;
}

export default function BriefPageEnhanced({ initialSlug }: BriefPageEnhancedProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [showUserGuide, setShowUserGuide] = useState(false);

  const { data: allRes, isLoading } = trpc.n8n.getAll.useQuery();
  const dbRows = allRes?.briefs ?? [];

  const allBriefs = useMemo<Record<string, DailyBrief>>(() => {
    const map: Record<string, DailyBrief> = {};
    for (const row of dbRows) {
      map[row.dateSlug] = rowToBrief(row);
    }
    return map;
  }, [dbRows]);

  const activeBriefSlug = useMemo(() => {
    if (selectedSlug && allBriefs[selectedSlug]) return selectedSlug;
    return dbRows[0]?.dateSlug ?? null;
  }, [selectedSlug, allBriefs, dbRows]);

  const brief = activeBriefSlug ? allBriefs[activeBriefSlug] : null;

  // Canonical "read the full brief" URL for the active brief.
  const briefUrl = useMemo(
    () => dbRows.find((r) => r.dateSlug === activeBriefSlug)?.telegraphUrl ?? null,
    [dbRows, activeBriefSlug]
  );

  const handleSelectBrief = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-cyan-dim)" }} />
        <p className="text-xs font-mono tracking-[0.15em]" style={{ color: "var(--color-mist-faint)" }}>
          PREPARING YOUR BRIEF
        </p>
      </div>
    );
  }

  if (!brief || !activeBriefSlug) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="container py-24 text-center">
          <p style={{ color: "var(--color-mist-dim)" }}>No briefs available yet.</p>
          <p className="text-xs font-mono mt-2" style={{ color: "var(--color-mist-faint)" }}>
            Publish a brief via POST /api/publish to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader greeting={brief.greeting} teaser={brief.teaser} />

      {/* Brief picker row — locks beneath the sticky header so the date switcher,
          Telegram CTA and "full brief" link stay reachable while reading. */}
      <div
        className="sticky z-30 border-b border-border/40 backdrop-blur-md"
        style={{ top: "var(--nav-h)", background: "color-mix(in oklab, var(--background) 93%, transparent)" }}
      >
        <div className="container py-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="max-w-[240px]">
            <WeeklyBriefSelector
              briefs={allBriefs}
              selectedBriefKey={activeBriefSlug}
              onSelectBrief={handleSelectBrief}
            />
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/TheDailyRipple"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap shrink-0"
              style={{
                color: "var(--color-cyan)",
                border: "1px solid color-mix(in oklab, var(--color-cyan) 45%, transparent)",
                background: "color-mix(in oklab, var(--color-cyan) 10%, transparent)",
              }}
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">For the latest updates</span>
              <span className="sm:hidden">Telegram</span>
            </a>
            {briefUrl && (
              <a
                href={briefUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3.5 py-2 transition-colors whitespace-nowrap shrink-0"
                style={{
                  color: "var(--color-cyan)",
                  border: "1px solid color-mix(in oklab, var(--color-cyan) 45%, transparent)",
                  background: "color-mix(in oklab, var(--color-cyan) 10%, transparent)",
                }}
              >
                <span className="hidden sm:inline">Read the full brief</span>
                <span className="sm:hidden">Full brief</span>
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={() => setShowUserGuide(true)}
              className="p-1.5 rounded transition-colors hover:bg-white/5"
              style={{ color: "var(--color-mist-faint)" }}
              aria-label="Help"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <main className="container py-4">
        <div className="mx-auto w-full" style={{ maxWidth: 1040 }}>
          <TodayBriefList brief={brief} slug={activeBriefSlug} />
        </div>
      </main>

      {/* User guide modal */}
      {showUserGuide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                How to navigate
              </h3>
              <button
                onClick={() => setShowUserGuide(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm" style={{ color: "var(--color-mist-dim)" }}>
              <li>• Today's Brief lists all 8 stories — tap any one to open the full story</li>
              <li>• Each story opens the full analysis, its Singapore Lens, and every source we used</li>
              <li>• The date picker switches to past briefs; Archive browses them all</li>
              <li>• Signals tracks live markets and resolves the watch-signals flagged in past briefs</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
