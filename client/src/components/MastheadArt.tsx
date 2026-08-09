/**
 * MastheadArt — the banner artwork, theme-aware, with a text fallback.
 *
 * Since the Aug 2026 UX revamp the masthead no longer sits atop every page; this
 * is its home on the About page. Drop the artwork at client/public/masthead-banner.png
 * (+ -light.png) and it renders; until then the text masthead shows.
 */

import { useState, useEffect } from "react";

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

export default function MastheadArt({ className = "" }: { className?: string }) {
  const band = useThemeBand();
  const isLightBand = band === "morning" || band === "midday";
  const bannerSrc = isLightBand ? BANNER_LIGHT : BANNER_DARK;
  const [bannerOk, setBannerOk] = useState(true);

  if (!bannerOk) {
    return (
      <div className={`text-center ${className}`}>
        <h2
          className="text-3xl sm:text-4xl font-bold tracking-tight leading-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}
        >
          The Daily Ripple
        </h2>
        <p
          className="text-[10px] tracking-[0.22em] uppercase mt-2.5"
          style={{ color: "var(--color-mist-faint)" }}
        >
          Your World, Connected · Your Singapore, Ahead
        </p>
      </div>
    );
  }

  return (
    <img
      src={bannerSrc}
      alt="The Daily Ripple — Your world, connected. Your Singapore, ahead."
      onError={() => setBannerOk(false)}
      className={`w-full h-auto block object-contain rounded-xl border border-border/50 ${className}`}
    />
  );
}
