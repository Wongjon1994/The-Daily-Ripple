/**
 * Archive (UX-revamp §6.3) — past briefs grouped under week signposts
 * ("This week", "Last week", …), replacing the old month calendar grid.
 *
 * Two tiers keep the scroll bounded:
 *   • Browse mode (no search): rich headline rows for the recent weeks
 *     (this week → 2 weeks ago), then everything older folds behind an
 *     expandable month calendar for jumping straight to a date.
 *   • Search mode (query present): the tiers flatten — a single week-grouped
 *     list of ALL matching briefs across the whole archive, so nothing older is
 *     ever hidden from search.
 *
 * Rows sit one-per-line on mobile and in a two-column grid from lg up.
 */

import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Search, ChevronRight, ChevronLeft, CalendarDays, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import SiteHeader from "@/components/SiteHeader";
import { parseBriefDate } from "@/lib/dateUtils";
import { getWeekKey, getWeekLabel, getWeekOffset, sortWeekKeys } from "@/lib/weekUtils";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// Recent weeks shown as rich rows in browse mode; older folds into the calendar.
const RECENT_WEEK_LIMIT = 2; // offsets 0,1,2 → this week, last week, 2 weeks ago

interface ArchiveItem {
  slug: string;
  date: string;
  iso: string;
  weekday: string;
  day: number;
  offset: number;
  leadHeadline: string;
  storyCount: number;
  synthesisCount: number;
  haystack: string;
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Server (getArchive) already computes the lead headline + counts + headlines,
 *  so this just derives the calendar/grouping date fields. */
function rowToItem(row: any): ArchiveItem {
  const d = parseBriefDate(row.date);
  const headlines: string[] = Array.isArray(row.headlines) ? row.headlines : [];
  return {
    slug: row.dateSlug,
    date: row.date,
    iso: isoOf(d),
    weekday: WEEKDAYS[d.getDay()] ?? "",
    day: d.getDate(),
    offset: getWeekOffset(row.date),
    leadHeadline: row.leadHeadline ?? row.date,
    storyCount: row.storyCount ?? 0,
    synthesisCount: row.synthesisCount ?? 0,
    haystack: `${row.date} ${headlines.join(" ")}`.toLowerCase(),
  };
}

/** Group a set of items into week sections, newest week first. */
function toWeekGroups(items: ArchiveItem[]) {
  const byWeek: Record<string, ArchiveItem[]> = {};
  for (const it of items) (byWeek[getWeekKey(it.date)] ??= []).push(it);
  return sortWeekKeys(Object.keys(byWeek)).map((key) => {
    const rows = byWeek[key].sort((a, b) => parseBriefDate(b.date).getTime() - parseBriefDate(a.date).getTime());
    return { key, label: getWeekLabel(rows[0].date), rows };
  });
}

function ArchiveRow({ item }: { item: ArchiveItem }) {
  const meta = [
    `${item.storyCount} ${item.storyCount === 1 ? "story" : "stories"}`,
    item.synthesisCount > 0 ? `${item.synthesisCount} synthesis` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/brief/${item.slug}`}
      className="group flex items-center gap-3.5 py-3 border-b border-border/40 transition-colors"
    >
      <div className="w-10 shrink-0 text-center">
        <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--color-mist-faint)" }}>{item.weekday}</p>
        <p className="text-[15px] font-semibold font-mono" style={{ color: "var(--color-mist)" }}>{item.day}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[14px] font-semibold leading-snug truncate transition-colors group-hover:text-[var(--color-cyan)]"
          style={{ color: "var(--color-mist)" }}
        >
          {item.leadHeadline}
        </p>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--color-mist-faint)" }}>{meta}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--color-mist-faint)" }} />
    </Link>
  );
}

function WeekGroup({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-mist-dim)" }}>{label}</h2>
        <span className="text-[10px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
          {count} brief{count === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-8">{children}</div>
    </section>
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Month calendar for jumping to any past brief by date. Dots mark days that
 *  have a brief; opens on the month of the newest "older" brief. */
function ArchiveCalendar({ items, initialIso }: { items: ArchiveItem[]; initialIso: string }) {
  const [, navigate] = useLocation();
  const { available, slugByDate } = useMemo(() => {
    const set = new Set<string>();
    const map = new Map<string, string>();
    for (const it of items) {
      set.add(it.iso);
      map.set(it.iso, it.slug);
    }
    return { available: set, slugByDate: map };
  }, [items]);

  const init = new Date(`${initialIso}T00:00:00`);
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());

  const cells = useMemo(() => {
    const total = new Date(viewYear, viewMonth + 1, 0).getDate();
    const first = new Date(viewYear, viewMonth, 1);
    const startOffset = (first.getDay() + 6) % 7; // Monday-first
    const out: Array<{ day: number | null; iso: string | null }> = [];
    for (let i = 0; i < startOffset; i++) out.push({ day: null, iso: null });
    for (let d = 1; d <= total; d++) out.push({ day: d, iso: isoOf(new Date(viewYear, viewMonth, d)) });
    while (out.length % 7 !== 0) out.push({ day: null, iso: null });
    return out;
  }, [viewYear, viewMonth]);

  const monthCount = items.filter((it) => it.iso.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`)).length;
  const prevMonth = () => (viewMonth === 0 ? (setViewYear((y) => y - 1), setViewMonth(11)) : setViewMonth((m) => m - 1));
  const nextMonth = () => (viewMonth === 11 ? (setViewYear((y) => y + 1), setViewMonth(0)) : setViewMonth((m) => m + 1));

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 mt-3">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--color-mist-dim)" }} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <h3 className="text-base font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}>
            {MONTHS[viewMonth]} {viewYear}
          </h3>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: "var(--color-mist-faint)" }}>
            {monthCount} brief{monthCount === 1 ? "" : "s"}
          </p>
        </div>
        <button onClick={nextMonth} className="p-1.5 rounded hover:bg-white/5" style={{ color: "var(--color-mist-dim)" }} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold py-1" style={{ color: "var(--color-mist-faint)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell.day || !cell.iso) return <div key={idx} />;
          const has = available.has(cell.iso);
          return (
            <button
              key={idx}
              disabled={!has}
              onClick={() => has && navigate(`/brief/${slugByDate.get(cell.iso!)}`)}
              className={cn(
                "relative aspect-square rounded-lg flex items-center justify-center text-[13px] font-mono border transition-colors",
                has ? "cursor-pointer border-border/40 hover:border-[var(--color-cyan)]/50 hover:bg-[var(--color-cyan)]/10" : "cursor-default border-transparent"
              )}
              style={{ color: has ? "var(--color-mist)" : "var(--color-mist-faint)", opacity: has ? 1 : 0.4 }}
            >
              {cell.day}
              {has && <span className="absolute bottom-1 w-1 h-1 rounded-full" style={{ background: "var(--color-cyan)" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ArchivePage() {
  const { data, isLoading } = trpc.n8n.getArchive.useQuery();
  const [query, setQuery] = useState("");
  const [showOlder, setShowOlder] = useState(false);

  const items = useMemo(() => (data?.items ?? []).map(rowToItem), [data]);
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  // Search mode: flatten across the whole archive. Browse mode: split recent/older.
  const searchGroups = useMemo(
    () => (searching ? toWeekGroups(items.filter((it) => it.haystack.includes(q))) : []),
    [items, q, searching]
  );
  const recentGroups = useMemo(
    () => (searching ? [] : toWeekGroups(items.filter((it) => it.offset <= RECENT_WEEK_LIMIT))),
    [items, searching]
  );
  const olderItems = useMemo(
    () => (searching ? [] : items.filter((it) => it.offset > RECENT_WEEK_LIMIT)),
    [items, searching]
  );
  const olderInitialIso = olderItems[0]?.iso ?? items[0]?.iso ?? isoOf(new Date());

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="container py-8">
        <div className="max-w-3xl mx-auto">
          {/* Search / filter — always searches the whole archive. */}
          <div
            className="flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 mb-7"
            style={{ borderColor: "var(--border)", background: "color-mix(in oklab, var(--card) 88%, transparent)" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-mist-faint)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the archive…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
              style={{ color: "var(--color-mist)" }}
              aria-label="Search the archive"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="shrink-0 p-0.5 rounded hover:bg-white/5">
                <X className="h-3.5 w-3.5" style={{ color: "var(--color-mist-faint)" }} />
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-cyan-dim)" }} />
            </div>
          ) : searching ? (
            // ── Search mode: flat, all-time results ──────────────────────────
            searchGroups.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-card p-10 text-center">
                <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>No briefs match your search.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {searchGroups.map((g) => (
                  <WeekGroup key={g.key} label={g.label} count={g.rows.length}>
                    {g.rows.map((it) => <ArchiveRow key={it.slug} item={it} />)}
                  </WeekGroup>
                ))}
              </div>
            )
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-10 text-center">
              <p className="text-sm" style={{ color: "var(--color-mist-dim)" }}>No briefs in the archive yet.</p>
            </div>
          ) : (
            // ── Browse mode: recent rows + older-by-date calendar ────────────
            <div className="space-y-8">
              {recentGroups.map((g) => (
                <WeekGroup key={g.key} label={g.label} count={g.rows.length}>
                  {g.rows.map((it) => <ArchiveRow key={it.slug} item={it} />)}
                </WeekGroup>
              ))}

              {olderItems.length > 0 && (
                <section>
                  <button
                    onClick={() => setShowOlder((v) => !v)}
                    aria-expanded={showOlder}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border/50 px-4 py-3 transition-colors hover:border-[var(--color-cyan)]/40"
                    style={{ background: "color-mix(in oklab, var(--card) 88%, transparent)" }}
                  >
                    <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "var(--color-cyan)" }} />
                    <span className="text-[13px] font-semibold" style={{ color: "var(--color-mist)" }}>
                      Browse earlier briefs by date
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
                      {olderItems.length} older
                    </span>
                    <ChevronRight
                      className={cn("h-4 w-4 ml-auto shrink-0 transition-transform", showOlder && "rotate-90")}
                      style={{ color: "var(--color-mist-faint)" }}
                    />
                  </button>
                  {showOlder && <ArchiveCalendar items={items} initialIso={olderInitialIso} />}
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
