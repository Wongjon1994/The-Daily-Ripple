/**
 * Markets grid instruments. Symbols match the server's /api/markets keys.
 * `group` drives the section a card appears under; `proxy` notes the ETF a US
 * index is derived from (TD free has no raw indices). Equity indices come from
 * Twelve Data ETFs (scaled server-side), Gold from TD XAU/USD, FX from TD forex,
 * Brent + 10Y yield from Alpha Vantage.
 */

import { Droplet, Coins, type LucideIcon } from "lucide-react";

export type InstrumentGroup = "exchange" | "ratecom" | "fx";

export type InstrumentDef = {
  symbol: string;
  label: string;
  /** Country flag (emoji) for indices/FX; commodities use a Lucide `icon` instead. */
  flag: string;
  /** Lucide icon override — used for commodities so we don't mix medal/oil emoji in. */
  icon?: LucideIcon;
  color: string;
  currency: string;
  exchange: string;
  group: InstrumentGroup;
  /** US index proxy ETF, surfaced on the card (e.g. "SPY"). */
  proxy?: string;
  isFx?: boolean;
  isYield?: boolean;
  isCommodity?: boolean;
};

export const INSTRUMENTS: InstrumentDef[] = [
  // ── Exchanges (US indices via ETF proxies) ──────────────────────────────────
  { symbol: "^GSPC", label: "S&P 500", flag: "🇺🇸", color: "#60a5fa", currency: "USD", exchange: "NYSE", group: "exchange", proxy: "SPY" },
  { symbol: "^NDX", label: "Nasdaq 100", flag: "🇺🇸", color: "#c084fc", currency: "USD", exchange: "NASDAQ", group: "exchange", proxy: "QQQ" },
  { symbol: "^DJI", label: "Dow Jones", flag: "🇺🇸", color: "#818cf8", currency: "USD", exchange: "NYSE", group: "exchange", proxy: "DIA" },
  // ── Rates & commodities ─────────────────────────────────────────────────────
  { symbol: "US10Y", label: "US 10Y", flag: "🇺🇸", color: "#fbbf24", currency: "USD", exchange: "CBOE", group: "ratecom", isYield: true },
  { symbol: "BRENT", label: "Brent Crude", flag: "🛢️", icon: Droplet, color: "#fb923c", currency: "USD", exchange: "ICE", group: "ratecom", isCommodity: true },
  { symbol: "GOLD", label: "Gold", flag: "🥇", icon: Coins, color: "#fbbf24", currency: "USD", exchange: "COMEX", group: "ratecom", isCommodity: true },
  // ── FX (vs SGD) ─────────────────────────────────────────────────────────────
  { symbol: "USDSGD", label: "USD/SGD", flag: "🇺🇸", color: "#2dd4bf", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
  { symbol: "JPYSGD", label: "JPY/SGD", flag: "🇯🇵", color: "#f87171", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
  { symbol: "EURSGD", label: "EUR/SGD", flag: "🇪🇺", color: "#a78bfa", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
  { symbol: "GBPSGD", label: "GBP/SGD", flag: "🇬🇧", color: "#f472b6", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
  { symbol: "AUDSGD", label: "AUD/SGD", flag: "🇦🇺", color: "#4ade80", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
  { symbol: "CNYSGD", label: "CNY/SGD", flag: "🇨🇳", color: "#fb7185", currency: "SGD", exchange: "FX", group: "fx", isFx: true },
];
