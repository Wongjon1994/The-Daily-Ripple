import { useState, useEffect, useCallback } from "react";
import { INSTRUMENTS, type InstrumentDef } from "@/lib/instruments";

export type MarketInstrument = InstrumentDef & {
  currentPrice: number;
  prevClose: number;
  dayChange: number;
  dayChangePct: number;
  rangeChangePct: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketVolume: number;
  series: { ts: number; v: number }[];
  recent: { date: string; v: number }[];
  error: boolean;
};

function blank(def: InstrumentDef): MarketInstrument {
  return {
    ...def,
    currentPrice: 0,
    prevClose: 0,
    dayChange: 0,
    dayChangePct: 0,
    rangeChangePct: 0,
    fiftyTwoWeekHigh: 0,
    fiftyTwoWeekLow: 0,
    regularMarketVolume: 0,
    series: [],
    recent: [],
    error: false,
  };
}

/** Fetches our own /api/markets (server fetches Yahoo via the residential proxy). */
export function useMarkets(range: string) {
  const [instruments, setInstruments] = useState<MarketInstrument[]>(INSTRUMENTS.map(blank));
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/markets?range=${encodeURIComponent(range)}`);
      const json = await res.json();
      const data: Record<string, Omit<MarketInstrument, keyof InstrumentDef | "error"> | null> = json?.data ?? {};
      setInstruments(
        INSTRUMENTS.map((def) => {
          const d = data[def.symbol];
          return d ? { ...def, ...d, error: false } : { ...blank(def), error: true };
        })
      );
    } catch {
      setInstruments(INSTRUMENTS.map((def) => ({ ...blank(def), error: true })));
    }
    setLoading(false);
    setFetching(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { instruments, loading, fetching, refetch: load };
}
