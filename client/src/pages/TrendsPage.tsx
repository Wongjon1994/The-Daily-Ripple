/**
 * Trends Page — metric-first dashboard across all briefs.
 */

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { DailyBrief } from "@/lib/briefParser";
import MastheadBanner from "@/components/MastheadBanner";
import TrendsDashboard from "@/components/TrendsDashboard";

function rowToBrief(row: any): DailyBrief {
  return {
    date: row.date,
    greeting: row.greeting,
    teaser: Array.isArray(row.teaser) ? row.teaser : [],
    sections: Array.isArray(row.sections) ? row.sections : [],
    systemsSynthesis: row.systemsSynthesis ?? { thesis: "", signals: [] },
  };
}

export default function TrendsPage() {
  const { data, isLoading } = trpc.n8n.getAll.useQuery();

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
          <TrendsDashboard briefs={allBriefs} />
        )}
      </main>
    </div>
  );
}
