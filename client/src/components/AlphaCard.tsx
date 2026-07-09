/**
 * Alpha card (Agentic Ripple, Phase D) — the daily "house view". Renders the
 * pre-generated `house_view` row: an opinionated, cross-cutting read on the
 * current open signals for the Singapore-professional persona, with a reasoning
 * trail back to the signals it leans on. Read-only; renders nothing until the
 * house view has been generated (so no empty placeholder).
 */

import { Compass, ArrowUpRight } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";

type Ref = { slug: string; storyIndex: number; text: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortIso = (s?: string | null) => {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}` : s;
};

const ACCENT = "var(--color-gold-rich)";

export default function AlphaCard() {
  const { data } = trpc.n8n.getHouseView.useQuery();
  const hv = data?.houseView;
  if (!hv) return null;
  const refs = ((hv.signalRefs ?? []) as Ref[]).slice(0, 4);

  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 sm:p-6"
      style={{
        border: `1px solid color-mix(in oklab, ${ACCENT} 40%, transparent)`,
        background: `color-mix(in oklab, ${ACCENT} 6%, var(--card))`,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${ACCENT}, transparent)` }} />

      <div className="flex items-center gap-1.5 font-mono font-semibold uppercase mb-3" style={{ color: ACCENT, fontSize: 10, letterSpacing: "0.08em" }}>
        <Compass className="h-3.5 w-3.5" />
        House View
        <span className="ml-auto" style={{ color: "var(--color-mist-faint)" }}>{shortIso(hv.date)}</span>
      </div>

      <h3 className="font-bold leading-snug mb-2.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)", fontSize: "clamp(1.2rem, 3.5vw, 1.5rem)" }}>
        {hv.headline}
      </h3>

      {hv.stance && (
        <div className="inline-flex items-center rounded-full px-2.5 py-0.5 mb-3 font-mono uppercase tracking-[0.06em]" style={{ color: ACCENT, background: `color-mix(in oklab, ${ACCENT} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${ACCENT} 30%, transparent)`, fontSize: 10 }}>
          {hv.stance}
        </div>
      )}

      <p className="leading-relaxed max-w-[780px]" style={{ color: "var(--color-mist-dim)", fontSize: 14 }}>
        {hv.thesis}
      </p>

      {refs.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="font-mono font-semibold uppercase mb-2" style={{ color: "var(--color-mist-faint)", fontSize: 9, letterSpacing: "0.08em" }}>
            Reasoning trail
          </div>
          <div className="flex flex-col gap-1.5">
            {refs.map((r, i) => (
              <Link
                key={i}
                href={`/brief/${r.slug}?story=${r.storyIndex + 1}`}
                className="flex items-start gap-1.5 text-[11px] leading-snug transition-colors hover:text-[var(--color-mist)]"
                style={{ color: "var(--color-mist-faint)" }}
              >
                <span className="line-clamp-1">{r.text}</span>
                <ArrowUpRight className="h-3 w-3 shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
