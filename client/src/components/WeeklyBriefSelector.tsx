/**
 * Weekly Brief Selector
 * Shows "This Week" and "Last Week" inline; older briefs link to /calendar.
 */

import { useMemo } from "react";
import { Link } from "wouter";
import { Calendar } from "lucide-react";
import type { DailyBrief } from "@/lib/briefParser";
import { formatBriefDate } from "@/lib/dateUtils";
import { groupBriefsByWeek, sortWeekKeys, getWeekLabel } from "@/lib/weekUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WeeklyBriefSelectorProps {
  briefs: Record<string, DailyBrief>;
  selectedBriefKey: string;
  onSelectBrief: (briefKey: string) => void;
}

export default function WeeklyBriefSelector({
  briefs,
  selectedBriefKey,
  onSelectBrief,
}: WeeklyBriefSelectorProps) {
  const briefsArray = useMemo(() => Object.values(briefs), [briefs]);
  const slugByBrief = useMemo(() => {
    const m = new Map<DailyBrief, string>();
    for (const [k, v] of Object.entries(briefs)) m.set(v, k);
    return m;
  }, [briefs]);

  const briefsByWeek = useMemo(() => groupBriefsByWeek(briefsArray), [briefsArray]);
  const sortedWeekKeys = useMemo(
    () => sortWeekKeys(Object.keys(briefsByWeek)),
    [briefsByWeek]
  );

  // Split into recent (this + last week) and archive
  const recentWeeks: Array<{ label: string; key: string; briefs: DailyBrief[] }> = [];
  const archiveCount = { briefs: 0 };

  sortedWeekKeys.forEach((weekKey) => {
    const b = briefsByWeek[weekKey];
    const label = getWeekLabel(b[0].date);
    if (label === "This Week" || label === "Last Week") {
      recentWeeks.push({ label, key: weekKey, briefs: b });
    } else {
      archiveCount.briefs += b.length;
    }
  });

  const selectedDate =
    selectedBriefKey && briefs[selectedBriefKey]
      ? briefs[selectedBriefKey].date
      : "Select a brief";

  return (
    <div className="flex flex-col gap-1">
      <Select value={selectedBriefKey} onValueChange={onSelectBrief}>
        <SelectTrigger className="w-full bg-card border-border/50 text-foreground/80 text-xs hover:bg-card/80 h-8">
          <SelectValue placeholder="Select a brief">
            <span className="font-mono">{selectedDate}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-card border-border/50">
          {recentWeeks.map(({ label, key, briefs: weekBriefs }, idx) => (
            <div key={key}>
              {idx > 0 && <div className="my-1 border-t border-border/30" />}
              <div className="px-2 py-1.5 text-[10px] font-semibold text-[var(--color-cyan)] uppercase tracking-widest">
                {label}
              </div>
              {weekBriefs.map((brief) => {
                const slug = slugByBrief.get(brief);
                if (!slug) return null;
                const isSelected = slug === selectedBriefKey;
                return (
                  <SelectItem
                    key={slug}
                    value={slug}
                    className={`pl-5 text-xs cursor-pointer ${
                      isSelected
                        ? "bg-[var(--color-cyan)]/10 text-foreground"
                        : "text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {formatBriefDate(brief.date)}
                      </span>
                      {isSelected && (
                        <span className="text-[var(--color-cyan)] text-[10px]">✓</span>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </div>
          ))}

          {/* Archive link */}
          {archiveCount.briefs > 0 && (
            <>
              <div className="my-1 border-t border-border/30" />
              <div className="px-2 py-1">
                <Link
                  href="/calendar"
                  className="flex items-center gap-2 px-3 py-2 rounded text-xs text-[var(--color-cyan-dim)] hover:text-[var(--color-cyan)] hover:bg-white/5 transition-all w-full"
                >
                  <Calendar className="h-3 w-3" />
                  View archive calendar
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">
                    +{archiveCount.briefs}
                  </span>
                </Link>
              </div>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
