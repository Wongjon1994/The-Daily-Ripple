/**
 * Signals Page — the agentic intelligence layer + supporting markets.
 * Fetches the persisted signal ledger and synthesis prose; TrendsDashboard renders.
 */

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { DailyBrief } from "@/lib/briefParser";
import MastheadBanner from "@/components/MastheadBanner";
import TrendsDashboard, { type TrendsWindow } from "@/components/TrendsDashboard";

function rowToBrief(row: any): DailyBrief {
  return {
    date: row.date,
    greeting: row.greeting,
    teaser: Array.isArray(row.teaser) ? row.teaser : [],
    sections: Array.isArray(row.sections) ? row.sections : [],
    systemsSynthesis: row.systemsSynthesis ?? { thesis: "", signals: [] },
  };
}

export default function SignalsPage() {
  const [window, setWindow] = useState<TrendsWindow>("1W");
  const { data, isLoading } = trpc.n8n.getAll.useQuery();
  const { data: signalsData } = trpc.n8n.getSignals.useQuery();
  const { data: insightsData } = trpc.n8n.getThemeInsights.useQuery({ window });

  const allBriefs = useMemo<Record<string, DailyBrief>>(() => {
    const map: Record<string, DailyBrief> = {};
    for (const row of data?.briefs ?? []) {
      map[row.dateSlug] = rowToBrief(row);
    }
    return map;
  }, [data]);

  return (
    <div className="min-h-screen">
      <MastheadBanner />
      <main className="container py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--color-cyan-dim)" }} />
          </div>
        ) : (
          <TrendsDashboard
            briefs={allBriefs}
            signals={signalsData?.signals ?? []}
            insights={insightsData?.insights ?? []}
            window={window}
            onWindowChange={setWindow}
          />
        )}
      </main>
    </div>
  );
}
