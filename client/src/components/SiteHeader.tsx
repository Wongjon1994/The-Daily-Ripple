/**
 * SiteHeader — global navigation chrome.
 *
 * Replaces the old full-height MastheadBanner. Per the Aug 2026 UX revamp the
 * masthead artwork no longer lives at the top of every page (it now headlines
 * the About page); the header here is slim at every width:
 *   • a compact wordmark + theme toggle (all widths),
 *   • a top tab bar with icons + a pill/underline active state (≥640px), and
 *   • a fixed bottom tab bar (<640px) with 44×44 icon+label targets.
 * The teaser ticker + local clock survive as a slim strip on ≥640px.
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Radar, CalendarDays, Info, type LucideIcon } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { trpc } from "@/lib/trpc";

interface SiteHeaderProps {
  greeting?: string;
  teaser?: string[];
}

/** Salutation by the reader's local time-of-day. */
function timeOfDaySalutation(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/** True when it's Sunday in Singapore — the weekly "no fresh brief" day. */
function isSundaySGT(): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Singapore",
    weekday: "short",
  }).format(new Date());
  return weekday === "Sun";
}

/** Sunday greeting — points the reader at the week's briefs for review. */
const SUNDAY_SECOND_SENTENCE =
  "This week's briefs are ready for your review — have a read. We'll see you next week.";

/** Clock in the reader's own timezone, labelled with their local tz. */
function LocalClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const t = now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const tz =
        new Intl.DateTimeFormat([], { timeZoneName: "short" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
      setTime(`${t} ${tz}`);
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[11px] tracking-[0.15em]" style={{ color: "var(--color-mist-faint)" }}>
      {time}
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the compact bottom tab bar (per the mobile mockups). */
  short: string;
  icon: LucideIcon;
}

// One source of truth for the primary nav — shared by the top tab bar and the
// bottom tab bar so their icons/labels stay in lockstep (spec §5: "keep the
// icons introduced on mobile for continuity").
const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today's Brief", short: "Brief", icon: BookOpen },
  { href: "/signals", label: "Signals", short: "Signals", icon: Radar },
  { href: "/calendar", label: "Archive", short: "Archive", icon: CalendarDays },
  { href: "/about", label: "About", short: "About", icon: Info },
];

function isActive(location: string, href: string): boolean {
  return location === href || (href !== "/" && location.startsWith(href));
}

/** The brand ripple mark (concentric rings + gold centre) — mirrors the favicon.
 *  Sits left of the wordmark, the way Ripple Transit fronts its wave mark. */
function RippleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true">
      <g fill="none" stroke="var(--color-cyan)" strokeWidth="4">
        <circle cx="32" cy="32" r="7" strokeOpacity="0.95" />
        <circle cx="32" cy="32" r="15" strokeOpacity="0.6" />
        <circle cx="32" cy="32" r="23" strokeOpacity="0.3" />
      </g>
      <circle cx="32" cy="32" r="4" fill="var(--color-gold-rich)" />
    </svg>
  );
}

/** Top tab bar — tablet/desktop (≥640px). Active tab gets a pill + underline so
 *  the state doesn't rely on colour alone (spec §5 / §8). */
function TopTabs({ location }: { location: string }) {
  return (
    <nav className="hidden sm:flex items-center gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(location, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] transition-colors"
            style={{
              color: active ? "var(--color-cyan)" : "var(--color-mist-dim)",
              background: active
                ? "color-mix(in oklab, var(--color-cyan) 12%, transparent)"
                : "transparent",
            }}
          >
            <Icon className="h-4 w-4" />
            {label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-3 right-3 -bottom-[7px] h-[2px] rounded-full"
                style={{ background: "var(--color-cyan)" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar — mobile (<640px). Fixed to the thumb zone; 44×44 targets. */
function BottomTabs({ location }: { location: string }) {
  return (
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-50 border-t backdrop-blur-md"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in oklab, var(--background) 92%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = isActive(location, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center justify-center gap-1 min-h-[56px] py-1.5 transition-colors"
              style={{ color: active ? "var(--color-cyan)" : "var(--color-mist-faint)" }}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-[2px] w-8 rounded-full"
                  style={{ background: "var(--color-cyan)" }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium tracking-[0.02em]">{short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function SiteHeader({ greeting, teaser: teaserProp = [] }: SiteHeaderProps) {
  const [location] = useLocation();

  // The teaser ticker shows on every tab. The brief page passes its own teaser;
  // other tabs fall back to the latest brief's headlines.
  const latest = trpc.n8n.getLatest.useQuery(undefined, {
    enabled: teaserProp.length === 0,
  });
  const teaser =
    teaserProp.length > 0
      ? teaserProp
      : ((latest.data?.brief?.teaser as string[] | undefined) ?? []);
  const [teaserIdx, setTeaserIdx] = useState(0);
  const [salutation, setSalutation] = useState(timeOfDaySalutation);
  const [isSunday, setIsSunday] = useState(isSundaySGT);

  useEffect(() => {
    const id = setInterval(() => {
      setSalutation(timeOfDaySalutation());
      setIsSunday(isSundaySGT());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Swap the brief's stored salutation for one matching the reader's time of day.
  let displayGreeting = greeting
    ? greeting.replace(/^good\s+(morning|afternoon|evening)/i, salutation)
    : greeting;

  // On Sundays there's no fresh brief — keep the salutation but invite the
  // reader to review the week's briefs instead of "Here is your daily brief".
  if (displayGreeting && isSunday) {
    displayGreeting = displayGreeting.replace(
      /^([^.]*\.)\s*[\s\S]*$/,
      `$1 ${SUNDAY_SECOND_SENTENCE}`
    );
  }

  useEffect(() => {
    if (teaser.length <= 1) return;
    const id = setInterval(() => setTeaserIdx((i) => (i + 1) % teaser.length), 5000);
    return () => clearInterval(id);
  }, [teaser.length]);

  return (
    <>
      {/* Slim sticky header — wordmark + toggle at every width; top tabs ≥640px.
          Height is the --nav-h anchor other sticky bars stack beneath. */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          height: "var(--nav-h)",
          borderColor: "color-mix(in oklab, var(--border) 80%, transparent)",
          background: "color-mix(in oklab, var(--background) 93%, transparent)",
        }}
      >
        <div className="container h-full flex items-center gap-4">
          <Link href="/" className="shrink-0 group flex items-center gap-2">
            <RippleMark className="h-6 w-6 shrink-0" />
            <span
              className="text-[15px] sm:text-base font-bold tracking-tight leading-none transition-colors"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}
            >
              The Daily Ripple
            </span>
          </Link>

          <div className="hidden sm:block mx-auto">
            <TopTabs location={location} />
          </div>

          <div className="ml-auto sm:ml-0 shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Teaser ticker + clock — a slim strip on ≥640px (hidden on the slim
          mobile header). Hidden on Sundays until Monday's fresh brief lands. */}
      {teaser.length > 0 && !isSunday && (
        <div className="hidden sm:block border-b border-border/40">
          <div className="container flex items-center gap-3 py-1.5">
            <span
              className="text-[9px] font-mono tracking-[0.2em] uppercase shrink-0"
              style={{ color: "var(--color-cyan)" }}
            >
              Today
            </span>
            <div className="flex-1 overflow-hidden">
              <p
                key={teaserIdx}
                className="text-[11px] truncate animate-fade-in"
                style={{ color: "var(--color-mist-dim)" }}
              >
                {teaser[teaserIdx]}
              </p>
            </div>
            <LocalClock />
          </div>
        </div>
      )}

      {/* Greeting */}
      {greeting && (
        <div className="border-b border-border/40">
          <div className="container py-2.5 text-center">
            <p
              className="text-sm italic leading-relaxed max-w-2xl mx-auto"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-gold-rich)" }}
            >
              {displayGreeting}
            </p>
          </div>
        </div>
      )}

      <BottomTabs location={location} />
    </>
  );
}
