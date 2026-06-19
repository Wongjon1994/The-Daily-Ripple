/**
 * Market Ticker Handler
 * Fetches live market data from Yahoo Finance via Forge API
 * Called by Heartbeat every 60 seconds
 */

import type { Request, Response } from "express";

interface TickerItem {
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "neutral";
}

const SYMBOLS = [
  { symbol: "BZ=F", label: "Brent Crude" },
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^STI", label: "SGX STI" },
  { symbol: "SGD=X", label: "USD/SGD" },
  { symbol: "GC=F", label: "Gold" },
  { symbol: "^VIX", label: "VIX" },
];

/**
 * Fetch live market data from Yahoo Finance
 */
export async function fetchLiveMarketData(): Promise<TickerItem[]> {
  const forgeUrl = process.env.BUILT_IN_FORGE_API_URL || "";
  const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || "";

  if (!forgeUrl || !forgeKey) {
    throw new Error("Forge API not configured");
  }

  const symbolList = SYMBOLS.map((s) => s.symbol).join(",");
  const endpoint = `${forgeUrl.replace(/\/+$/, "")}/v1/data_api/yahoo_finance/quotes?symbols=${encodeURIComponent(symbolList)}`;

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${forgeKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.statusText}`);
  }

  const data = await response.json();

  return SYMBOLS.map((symbol) => {
    const quote = data.quoteResponse?.result?.find((q: any) => q.symbol === symbol.symbol);

    if (!quote) {
      return {
        label: symbol.label,
        value: "N/A",
        change: "N/A",
        direction: "neutral",
      };
    }

    const price = quote.regularMarketPrice ?? 0;
    const previousClose = quote.regularMarketPreviousClose ?? price;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    const formattedPrice = price.toFixed(2);
    const direction: "up" | "down" | "neutral" = change > 0 ? "up" : change < 0 ? "down" : "neutral";

    return {
      label: symbol.label,
      value: formattedPrice,
      change: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
      direction,
    };
  });
}

/**
 * Heartbeat handler for market ticker updates
 * Called every 60 seconds by Heartbeat
 */
export async function handleMarketTickerUpdate(req: Request, res: Response) {
  try {
    const tickerData = await fetchLiveMarketData();

    // Log the update for monitoring
    console.log(`[Market Ticker] Updated at ${new Date().toISOString()}`);
    console.log(`[Market Ticker] Fetched ${tickerData.length} symbols`);

    // Return success response
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      tickerCount: tickerData.length,
      data: tickerData,
    });
  } catch (error) {
    console.error("[Market Ticker] Error:", error);

    res.status(500).json({
      error: `Market ticker update failed: ${String(error)}`,
      timestamp: new Date().toISOString(),
      context: {
        url: req.url,
        method: req.method,
      },
    });
  }
}

/**
 * Get current market ticker data
 * Returns the most recently fetched data
 */
let cachedTickerData: TickerItem[] | null = null;
let lastUpdateTime: Date | null = null;

export async function getCachedMarketTicker(): Promise<{
  data: TickerItem[];
  lastUpdated: Date | null;
}> {
  // If cache is older than 5 minutes, fetch fresh data
  if (!cachedTickerData || !lastUpdateTime || Date.now() - lastUpdateTime.getTime() > 5 * 60 * 1000) {
    try {
      cachedTickerData = await fetchLiveMarketData();
      lastUpdateTime = new Date();
    } catch (error) {
      console.error("[Market Ticker Cache] Fetch failed:", error);
      // Return empty data if fetch fails
      cachedTickerData = [];
    }
  }

  return {
    data: cachedTickerData || [],
    lastUpdated: lastUpdateTime,
  };
}

/**
 * Update cached ticker data
 * Called by Heartbeat handler
 */
export async function updateCachedMarketTicker(): Promise<void> {
  try {
    cachedTickerData = await fetchLiveMarketData();
    lastUpdateTime = new Date();
  } catch (error) {
    console.error("[Market Ticker] Cache update failed:", error);
  }
}
