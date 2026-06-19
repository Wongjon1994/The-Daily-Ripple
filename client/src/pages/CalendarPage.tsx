/**
 * Calendar Archive Page
 * A monthly calendar grid; dates with briefs are highlighted and clickable.
 */

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import MastheadBanner from "@/components/MastheadBanner";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Returns the day-of-week index Monday=0 … Sunday=6 */
function mondayIndex(dateISO: string) {
  const d = new Date(dateISO + "T00:00:00");
  return (d.getDay() + 6) % 7;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const { data, isLoading } = trpc.n8n.getBriefDates.useQuery();
  const briefDates = data?.dates ?? [];

  const availableSet = useMemo(() => {
    const s = new Set<string>();
    for (const d of briefDates) s.add(d.briefDate);
    return s;
  }, [briefDates]);

  const slugByDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of briefDates) m.set(d.briefDate, d.dateSlug);
    return m;
  }, [briefDates]);

  const calendarDays = useMemo(() => {
    const totalDays = daysInMonth(viewYear, viewMonth);
    const startOffset = mondayIndex(isoDate(viewYear, viewMonth, 1));
    const cells: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ day: null, iso: null });
    for (let d = 1; d <= totalDays; d++) cells.push({ day: d, iso: isoDate(viewYear, viewMonth, d) });
    while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
    return cells;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const handleDayClick = (iso: string) => {
    const slug = slugByDate.get(iso);
    if (slug) navigate(`/brief/${slug}`);
  };

  const todayISO = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const monthCount = briefDates.filter((d) =>
    d.briefDate.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`)
  ).length;

  return (
    <div className="min-h-screen">
      <MastheadBanner />

      <main className="container py-10">
        <div className="max-w-2xl mx-auto">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-7">
            <button
              onClick={goToPrevMonth}
              className="p-2 rounded transition-colors hover:bg-white/5"
              style={{ color: "var(--color-mist-dim)" }}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}>
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <p className="text-xs font-mono mt-1" style={{ color: "var(--color-gold-rich)" }}>
                {monthCount} brief{monthCount === 1 ? "" : "s"} this month
              </p>
            </div>

            <button
              onClick={goToNextMonth}
              className="p-2 rounded transition-colors hover:bg-white/5"
              style={{ color: "var(--color-mist-dim)" }}
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-cyan-dim)" }} />
            </div>
          ) : (
            <>
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-2">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="text-center text-[11px] font-semibold tracking-[0.15em] uppercase py-2" style={{ color: "var(--color-mist-dim)" }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((cell, idx) => {
                  if (!cell.day || !cell.iso) return <div key={idx} />;
                  const hasBrief = availableSet.has(cell.iso);
                  const isToday = cell.iso === todayISO;
                  return (
                    <button
                      key={idx}
                      disabled={!hasBrief}
                      onClick={() => hasBrief && handleDayClick(cell.iso!)}
                      className={cn(
                        "relative aspect-square rounded-lg flex items-center justify-center text-sm font-mono transition-colors border",
                        hasBrief
                          ? "cursor-pointer border-border/40 hover:bg-[var(--color-cyan)]/10 hover:border-[var(--color-cyan)]/40"
                          : "cursor-default border-transparent",
                        isToday && "border-[var(--color-cyan)]/40"
                      )}
                      style={{
                        color: isToday
                          ? "var(--color-cyan)"
                          : hasBrief
                            ? "var(--color-mist)"
                            : "var(--color-mist-faint)",
                      }}
                    >
                      {cell.day}
                      {hasBrief && (
                        <span className="absolute bottom-1.5 w-1 h-1 rounded-full" style={{ background: "var(--color-cyan)" }} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-5 mt-7 text-[11px]" style={{ color: "var(--color-mist-dim)" }}>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[var(--color-cyan)]" />
                  Brief available
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full border border-[var(--color-cyan)]/50" />
                  Today
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
