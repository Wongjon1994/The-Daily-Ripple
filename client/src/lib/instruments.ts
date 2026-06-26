/**
 * Single source of truth for the Markets grid: which instruments appear, their
 * Yahoo symbol, and how they're labelled/coloured. Accent colours are tuned to
 * read on the Daily Ripple navy, not the reference dark theme.
 */

export type InstrumentDef = {
  symbol: string;
  label: string;
  flag: string;
  color: string;
  currency: string;
  exchange: string;
  isFx?: boolean;
  isYield?: boolean;
  isCommodity?: boolean;
};

export const INSTRUMENTS: InstrumentDef[] = [
  // ── Equity indices ──────────────────────────────────────────────────────────
  { symbol: "^STI", label: "STI", flag: "🇸🇬", color: "#2dd4bf", currency: "SGD", exchange: "SES" },
  { symbol: "^GSPC", label: "S&P 500", flag: "🇺🇸", color: "#60a5fa", currency: "USD", exchange: "NYSE" },
  { symbol: "^DJI", label: "Dow Jones", flag: "🇺🇸", color: "#818cf8", currency: "USD", exchange: "NYSE" },
  { symbol: "^N225", label: "Nikkei 225", flag: "🇯🇵", color: "#f87171", currency: "JPY", exchange: "OSE" },
  { symbol: "^HSI", label: "Hang Seng", flag: "🇭🇰", color: "#fbbf24", currency: "HKD", exchange: "HKEX" },
  { symbol: "^KS11", label: "KOSPI", flag: "🇰🇷", color: "#a78bfa", currency: "KRW", exchange: "KRX" },
  // ── FX pairs ───────────────────────────────────────────────────────────────
  { symbol: "JPY=X", label: "USD/JPY", flag: "🇯🇵", color: "#f87171", currency: "JPY", exchange: "FX", isFx: true },
  { symbol: "SGD=X", label: "USD/SGD", flag: "🇸🇬", color: "#2dd4bf", currency: "SGD", exchange: "FX", isFx: true },
  { symbol: "EUR=X", label: "USD/EUR", flag: "🇪🇺", color: "#60a5fa", currency: "EUR", exchange: "FX", isFx: true },
  // ── Rates ──────────────────────────────────────────────────────────────────
  { symbol: "^TNX", label: "US 10Y", flag: "🇺🇸", color: "#fbbf24", currency: "USD", exchange: "CBOE", isYield: true },
  // ── Commodities ────────────────────────────────────────────────────────────
  { symbol: "BZ=F", label: "Brent Crude", flag: "🛢️", color: "#fb923c", currency: "USD", exchange: "ICE", isCommodity: true },
  { symbol: "GC=F", label: "Gold", flag: "🥇", color: "#fbbf24", currency: "USD", exchange: "COMEX", isCommodity: true },
];
