/**
 * Masthead — banner image with graceful text fallback.
 * Drop the banner artwork at client/public/masthead-banner.png and it
 * replaces the text title automatically. Until then, the text masthead shows.
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import ThemeToggle from "./ThemeToggle";

interface MastheadBannerProps {
  greeting?: string;
  teaser?: string[];
}

const BANNER_DARK = "/masthead-banner.png";
const BANNER_LIGHT = "/masthead-banner-light.png";

/** Track the live data-theme band so the banner can swap with the theme. */
function useThemeBand(): string {
  const [band, setBand] = useState(
    () =>
      (typeof document !== "undefined" &&
        document.documentElement.getAttribute("data-theme")) ||
      "night"
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() =>
      setBand(el.getAttribute("data-theme") || "night")
    );
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return band;
}

/** Salutation by Singapore time-of-day. */
function timeOfDaySalutation(): string {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    hour12: false,
  }).format(new Date());
  const hour = Number(hourStr) % 24;
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

function SGTClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("en-SG", {
          timeZone: "Asia/Singapore",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-[11px] tracking-[0.15em]" style={{ color: "var(--color-mist-faint)" }}>
      {time} SGT
    </span>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Today's Brief" },
  { href: "/trends", label: "Trends" },
  { href: "/calendar", label: "Archive" },
  { href: "/about", label: "About" },
];

export default function MastheadBanner({
  greeting,
  teaser = [],
}: MastheadBannerProps) {
  const [location] = useLocation();
  const band = useThemeBand();
  const isLightBand = band === "morning" || band === "midday";
  const bannerSrc = isLightBand ? BANNER_LIGHT : BANNER_DARK;
  const [teaserIdx, setTeaserIdx] = useState(0);
  const [bannerOk, setBannerOk] = useState(true);
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
    <header className="border-b border-border/60 bg-background">
      {/* Teaser ticker — hidden on Sundays until Monday's fresh brief lands. */}
      {teaser.length > 0 && !isSunday && (
        <div className="border-b border-border/40">
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
            <SGTClock />
          </div>
        </div>
      )}

      {/* Banner image (falls back to text masthead if not present) */}
      {bannerOk ? (
        <Link href="/" className="block">
          <img
            src={bannerSrc}
            alt="The Daily Ripple — Your world, connected. Your Singapore, ahead."
            onError={() => setBannerOk(false)}
            className="masthead-banner w-full h-auto block max-w-5xl mx-auto object-contain max-h-[110px] sm:max-h-[140px] lg:max-h-[160px]"
          />
        </Link>
      ) : (
        <div className="container pt-7 pb-1 text-center">
          <Link href="/" className="inline-block group">
            <h1
              className="text-3xl lg:text-4xl font-bold tracking-tight leading-none transition-colors"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}
            >
              The Daily Ripple
            </h1>
          </Link>
          <p
            className="text-[10px] tracking-[0.22em] uppercase mt-2.5"
            style={{ color: "var(--color-mist-faint)" }}
          >
            Your World, Connected · Your Singapore, Ahead
          </p>
        </div>
      )}

    </header>

      {/* Sticky nav row — locks to the top once the banner scrolls away.
          Sits as a page-level sibling so its sticky context is the whole page,
          not just the masthead. Height is the --nav-h anchor other sticky
          bars (date picker, section headers) stack beneath. */}
      <div
        className="sticky top-0 z-40 border-y border-border/50 backdrop-blur-md"
        style={{ height: "var(--nav-h)", background: "color-mix(in oklab, var(--background) 93%, transparent)" }}
      >
        <div className="container h-full flex items-center justify-center gap-4 relative">
          <nav className="flex items-center gap-1 sm:gap-2">
            {NAV_ITEMS.map(({ href, label }) => {
              const active =
                location === href || (href !== "/" && location.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className="px-2.5 sm:px-3 py-1.5 rounded text-[13px] transition-colors"
                  style={{
                    color: active ? "var(--color-cyan)" : "var(--color-mist-dim)",
                    background: active ? "color-mix(in oklab, var(--color-cyan) 12%, transparent)" : "transparent",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2">
            <ThemeToggle />
          </div>
        </div>
      </div>

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
    </>
  );
}
