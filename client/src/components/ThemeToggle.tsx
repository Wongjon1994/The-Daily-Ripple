/**
 * Theme toggle — Auto / Light / Dark.
 *
 * "Auto" follows the reader's local hour through four time-of-day bands
 * (morning · midday · evening · night); "Light" pins midday and "Dark" pins
 * night. The actual data-theme stamping lives in a pre-paint script in
 * index.html (window.applyRippleTheme) so the first paint never flashes; this
 * control just persists the chosen mode and re-applies it.
 */

import { useEffect, useState } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";

type Mode = "auto" | "light" | "dark";
const ORDER: Mode[] = ["auto", "light", "dark"];
const STORAGE_KEY = "ripple-theme-mode";

declare global {
  interface Window {
    applyRippleTheme?: (mode?: string) => string;
  }
}

const META: Record<Mode, { icon: typeof Sun; label: string }> = {
  auto: { icon: SunMoon, label: "Auto" },
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
};

function readMode(): Mode {
  const m = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as Mode | null;
  return m && ORDER.includes(m) ? m : "auto";
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(readMode);

  const apply = (next: Mode) => {
    localStorage.setItem(STORAGE_KEY, next);
    window.applyRippleTheme?.(next);
    setMode(next);
  };

  const cycle = () => apply(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]);

  // In Auto, re-apply periodically so the band follows the clock while the
  // page stays open (e.g. crossing 18:00 from midday into evening).
  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(() => window.applyRippleTheme?.("auto"), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const { icon: Icon, label } = META[mode];

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors hover:bg-white/5"
      style={{ color: "var(--color-mist-dim)" }}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
