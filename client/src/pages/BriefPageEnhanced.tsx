/**
 * Brief Page — the swipeable reading deck, database-driven.
 * Trends lives at /trends; archive at /calendar.
 */

import { useState, useCallback, useMemo } from "react";
import type { DailyBrief } from "@/lib/briefParser";
import MastheadBanner from "@/components/MastheadBanner";
import SwipeDemo from "@/components/SwipeDemo";
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
  initialSectionIndex?: number;
}

export default function BriefPageEnhanced({ initialSlug, initialSectionIndex = 0 }: BriefPageEnhancedProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(initialSectionIndex);
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
    setCurrentSectionIndex(0);
  }, []);

  const handlePreviousSection = useCallback(() => {
    if (!brief) return;
    setCurrentSectionIndex((i) => (i === 0 ? brief.sections.length - 1 : i - 1));
  }, [brief]);

  const handleNextSection = useCallback(() => {
    if (!brief) return;
    setCurrentSectionIndex((i) => (i === brief.sections.length - 1 ? 0 : i + 1));
  }, [brief]);

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

  if (!brief) {
    return (
      <div className="min-h-screen">
        <MastheadBanner />
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
      <MastheadBanner greeting={brief.greeting} teaser={brief.teaser} />

      {/* Brief picker row — locks directly beneath the sticky nav so the date
          switcher and "full brief" link stay reachable while reading. */}
      <div
        className="sticky z-30 border-b border-border/40 backdrop-blur-md"
        style={{ top: "var(--nav-h)", background: "color-mix(in oklab, var(--background) 93%, transparent)" }}
      >
        <div className="container py-2.5 flex items-center justify-between gap-3">
          <div className="max-w-[240px]">
            <WeeklyBriefSelector
              briefs={allBriefs}
              selectedBriefKey={activeBriefSlug ?? ""}
              onSelectBrief={handleSelectBrief}
            />
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/TheDailyRipple"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3.5 py-2 transition-colors"
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
                className="flex items-center gap-2 text-[13px] font-semibold rounded-lg px-3.5 py-2 transition-colors"
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

      {/* Reading deck */}
      <main className="container py-3">
        <SwipeDemo
          brief={brief}
          currentIndex={currentSectionIndex}
          onPrevious={handlePreviousSection}
          onNext={handleNextSection}
          briefUrl={briefUrl}
        />
      </main>

      {/* User guide modal */}
      {showUserGuide && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-sm w-full border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-base font-bold"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                How to navigate
              </h3>
              <button
                onClick={() => setShowUserGuide(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-2 text-sm" style={{ color: "var(--color-mist-dim)" }}>
              <li>• Swipe left/right or use arrow keys to move between stories</li>
              <li>• "Read more" expands the full analysis and sources</li>
              <li>• The date picker switches to past briefs</li>
              <li>• Archive in the nav opens the calendar view</li>
              <li>• Trends charts recurring metrics across briefs</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
