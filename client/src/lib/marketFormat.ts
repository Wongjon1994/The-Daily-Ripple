import type { InstrumentDef } from "@/lib/instruments";

export function formatPrice(price: number, inst: InstrumentDef): string {
  if (!price) return "—";
  if (inst.isYield) return `${price.toFixed(2)}%`;
  if (inst.isFx) return price.toFixed(inst.currency === "JPY" ? 2 : 4);
  if (inst.isCommodity) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(price);
  }
  const dp = inst.currency === "JPY" || inst.currency === "KRW" ? 0 : 2;
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(price);
}

export function formatVolume(v: number): string {
  if (!v) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return String(v);
}

export function formatTick(ts: number, range: string): string {
  const d = new Date(ts * 1000);
  if (range === "1d" || range === "5d") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (range === "1mo" || range === "3mo") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", year: "2-digit" });
}

export function exchangeLabel(inst: InstrumentDef): string {
  if (inst.isYield) return "CBOE · %";
  if (inst.isFx) return `FX · ${inst.currency}`;
  if (inst.isCommodity) return `${inst.exchange} · USD`;
  return `${inst.exchange} · ${inst.currency}`;
}
