import { useState, useEffect, useCallback } from "react";
import { INSTRUMENTS, type InstrumentDef } from "@/lib/instruments";
import { fetchInstrument } from "@/lib/yahooFinance";

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
    error: false,
  };
}

export function useMarkets(range: string) {
  const [instruments, setInstruments] = useState<MarketInstrument[]>(INSTRUMENTS.map(blank));
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    const results = await Promise.allSettled(INSTRUMENTS.map((def) => fetchInstrument(def.symbol, range)));
    setInstruments(
      INSTRUMENTS.map((def, i) => {
        const r = results[i];
        if (r.status === "rejected") return { ...blank(def), error: true };
        const { quote, chart } = r.value;
        const firstClose = chart[0]?.v ?? quote.regularMarketPreviousClose;
        const lastClose = chart[chart.length - 1]?.v ?? quote.regularMarketPrice;
        const rangeChangePct = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
        return {
          ...def,
          currentPrice: quote.regularMarketPrice,
          prevClose: quote.regularMarketPreviousClose,
          dayChange: quote.regularMarketChange,
          dayChangePct: quote.regularMarketChangePercent,
          rangeChangePct,
          fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
          regularMarketVolume: quote.regularMarketVolume,
          series: chart,
          error: false,
        };
      })
    );
    setLoading(false);
    setFetching(false);
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return { instruments, loading, fetching, refetch: load };
}
