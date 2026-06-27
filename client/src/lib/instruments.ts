/**
 * Markets grid instruments. Symbols match the server's /api/markets keys.
 * Free US-only set: S&P 500 + Dow via Twelve Data (SPY/DIA, scaled server-side),
 * Brent / Gold / 10Y / SGD-FX via Alpha Vantage.
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
  { symbol: "^GSPC", label: "S&P 500", flag: "🇺🇸", color: "#60a5fa", currency: "USD", exchange: "NYSE" },
  { symbol: "^NDX", label: "Nasdaq 100", flag: "🇺🇸", color: "#c084fc", currency: "USD", exchange: "NASDAQ" },
  { symbol: "^DJI", label: "Dow Jones", flag: "🇺🇸", color: "#818cf8", currency: "USD", exchange: "NYSE" },
  { symbol: "BRENT", label: "Brent Crude", flag: "🛢️", color: "#fb923c", currency: "USD", exchange: "ICE", isCommodity: true },
  { symbol: "GOLD", label: "Gold", flag: "🥇", color: "#fbbf24", currency: "USD", exchange: "COMEX", isCommodity: true },
  { symbol: "US10Y", label: "US 10Y", flag: "🇺🇸", color: "#fbbf24", currency: "USD", exchange: "CBOE", isYield: true },
  { symbol: "USDSGD", label: "USD/SGD", flag: "🇸🇬", color: "#2dd4bf", currency: "SGD", exchange: "FX", isFx: true },
  { symbol: "JPYSGD", label: "JPY/SGD", flag: "🇯🇵", color: "#f87171", currency: "SGD", exchange: "FX", isFx: true },
  { symbol: "EURSGD", label: "EUR/SGD", flag: "🇪🇺", color: "#a78bfa", currency: "SGD", exchange: "FX", isFx: true },
];
