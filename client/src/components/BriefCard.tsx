/**
 * Brief Card Component
 * Individual story card for the bento layout.
 * Enhanced design: navy/amber palette, source link validation on expand.
 */

import { useState, useMemo, Fragment } from "react";
import type { BriefSection, KeyMetric } from "@/lib/briefParser";
import { partitionLensWatch, isSynthesisSection } from "@/lib/trendsAnalysis";
import { ChevronDown, Clock, ExternalLink, CheckCircle2, XCircle, HelpCircle, ShieldAlert, BookOpen, MapPin, ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

interface BriefCardProps {
  section: BriefSection;
  categoryColor?: string;
  /** Canonical "read the full brief" URL — fallback when a section has no sources. */
  briefUrl?: string | null;
  /** Focal card in the deck — gets the lifted spotlight shadow. */
  elevated?: boolean;
}

type LinkStatus = "ok" | "blocked" | "broken" | "unknown" | "loading";

// Quiet Authority: category colors are muted "voices" used only for label text
const CATEGORY_COLORS: Record<string, string> = {
  geopolitics: "oklch(0.62 0.105 35)",
  economics: "oklch(0.72 0.090 80)",
  markets: "oklch(0.66 0.065 150)",
  business: "oklch(0.72 0.090 80)",
  "ai-tech": "oklch(0.66 0.060 240)",
  tech: "oklch(0.66 0.060 240)",
  science: "oklch(0.66 0.060 280)",
  singapore: "oklch(0.66 0.065 150)",
  culture: "oklch(0.68 0.080 50)",
  health: "oklch(0.68 0.080 50)",
  systems: "oklch(0.66 0.060 280)",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category.toLowerCase()] ?? "oklch(0.62 0.010 260)";
}

function UrgencyDot({ urgency }: { urgency: BriefSection["urgency"] }) {
  if (urgency === "low") return null;
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full",
        urgency === "high" ? "bg-crimson" : "bg-[var(--color-cyan-dim)]"
      )}
      title={urgency === "high" ? "High priority" : "Medium priority"}
    />
  );
}

const STATUS_TITLE: Record<Exclude<LinkStatus, "loading">, string> = {
  ok: "Link verified",
  blocked: "Site blocks automated checks — likely fine in your browser",
  broken: "Link may be dead (404)",
  unknown: "Could not verify",
};

function LinkStatusIcon({ status }: { status: LinkStatus }) {
  if (status === "loading")
    return <span className="w-3 h-3 rounded-full border border-border/50 border-t-[var(--color-cyan-dim)] animate-spin inline-block shrink-0" />;
  if (status === "ok")
    return <CheckCircle2 className="h-3 w-3 text-sage shrink-0" aria-label={STATUS_TITLE.ok} />;
  if (status === "broken")
    return <XCircle className="h-3 w-3 text-crimson/70 shrink-0" aria-label={STATUS_TITLE.broken} />;
  if (status === "blocked")
    return <ShieldAlert className="h-3 w-3 text-muted-foreground/40 shrink-0" aria-label={STATUS_TITLE.blocked} />;
  return <HelpCircle className="h-3 w-3 text-muted-foreground/30 shrink-0" aria-label={STATUS_TITLE.unknown} />;
}

export default function BriefCard({ section, categoryColor, briefUrl, elevated }: BriefCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const color = categoryColor ?? getCategoryColor(section.category);

  const sourceUrls = useMemo(
    () => section.sources?.map((s) => s.url).filter(Boolean) ?? [],
    [section.sources]
  );

  const { data: linkData, isLoading: linksLoading } = trpc.n8n.validateLinks.useQuery(
    { urls: sourceUrls },
    { enabled: isExpanded && sourceUrls.length > 0, staleTime: 1000 * 60 * 10 }
  );

  const linkStatusMap = useMemo(() => {
    const m = new Map<string, LinkStatus>();
    for (const r of linkData?.results ?? []) {
      m.set(r.url, r.status as LinkStatus);
    }
    return m;
  }, [linkData]);

  const getStatus = (url: string): LinkStatus => {
    if (!isExpanded) return "unknown";
    if (linksLoading) return "loading";
    return linkStatusMap.get(url) ?? "unknown";
  };

  // Deck "lead-in": first few words form a gold runway into the standfirst.
  const summary = section.summary ?? "";
  const sw = summary.split(" ");
  const leadIn = sw.slice(0, 4).join(" ");
  const restSummary = sw.slice(4).join(" ");
  const longDeck = summary.length > 120;

  // Only treat the lens as a distinct "voice" when it isn't already echoed by
  // the body — systems-synthesis sections derive the lens from the same prose,
  // so showing both would just duplicate text.
  const showLens = useMemo(() => {
    if (!section.singaporeLens) return false;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const body = norm(section.paragraphs?.join(" ") ?? "");
    return !body.includes(norm(section.singaporeLens).slice(0, 50));
  }, [section.singaporeLens, section.paragraphs]);

  // The synthesis section (8) carries its "three signals to watch" inline in its
  // prose, not in a Singapore Lens — so for it we partition the paragraphs.
  const isSystems = isSynthesisSection(section);

  // Split the source into analysis + the forward-looking watch-signals it
  // carries. Uses the same extractor that feeds the Trends "Broader signals"
  // list, so the card's signals match what surfaces in Trends 1-to-1.
  const lensParts = useMemo(
    () =>
      partitionLensWatch(
        isSystems ? section.paragraphs.join("\n\n") : section.singaporeLens,
        isSystems
      ),
    [isSystems, section.paragraphs, section.singaporeLens]
  );

  // A short taste of the Singapore Lens, teased before expansion.
  const lensTeaser = useMemo(() => {
    if (!showLens) return "";
    const words = section.singaporeLens!.replace(/^Singapore'?s?\s+/i, "").split(" ");
    return words.slice(0, 16).join(" ") + (words.length > 16 ? "…" : "");
  }, [showLens, section.singaporeLens]);

  // CTA promises what's behind the fold so the click feels worth it.
  const ctaLabel = useMemo(() => {
    const bits = ["Full analysis"];
    if (showLens) bits.push("Singapore Lens");
    const n = section.sources?.length ?? 0;
    if (n > 0) bits.push(`${n} source${n === 1 ? "" : "s"}`);
    return bits.join("  ·  ");
  }, [showLens, section.sources]);

  // Metrics live inside the expanded read (a "by the numbers" strip), keeping
  // the collapsed face flowing headline → deck → lens → CTA without a break.
  const metrics = section.keyMetrics?.slice(0, 4) ?? [];

  // Body paragraphs after the lede, plus one punchy line lifted out as a
  // pull-quote to break the prose wall (removed from inline flow, not repeated).
  const bodyParas = useMemo(() => section.paragraphs?.slice(1) ?? [], [section.paragraphs]);
  const pullQuote = useMemo(() => {
    // Lift one punchy line from a body paragraph that keeps ≥1 other sentence,
    // so removing it for the quote doesn't gut the paragraph.
    for (const para of bodyParas) {
      const sentences = para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      if (sentences.length < 2) continue;
      const cands = sentences.filter((s) => s.length >= 55 && s.length <= 160);
      if (!cands.length) continue;
      return cands.find((s) => /\d|\bwill\b|\bcould\b|risk|watch|the tell/i.test(s)) ?? cands[0];
    }
    return null;
  }, [bodyParas]);

  return (
    <div
      className={cn(
        "relative h-full rounded-xl overflow-hidden",
        "border border-border hover:border-[var(--color-cyan)]/40",
        "bg-card transition-colors duration-300",
        elevated ? "card-lift" : "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.7)]"
      )}
    >
      {/* Ghosted story number — editorial watermark for per-card identity. */}
      {section.id && (
        <span
          aria-hidden="true"
          className="absolute -top-5 right-1 z-0 font-bold leading-none select-none pointer-events-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "104px", color, opacity: 0.055 }}
        >
          {section.id}
        </span>
      )}

      <div className="relative z-10 p-4 lg:p-5 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{section.emoji}</span>
            <span
              className="text-[11px] font-semibold tracking-[0.15em] uppercase"
              style={{ color }}
            >
              {/* Story 1 is always the day's lead — label it as such on the card,
                  even though its underlying category stays as the story's nature. */}
              {section.id === "1" ? "Lead story" : section.category.replace("-", " ")}
            </span>
            <UrgencyDot urgency={section.urgency} />
          </div>
          <div className="flex items-center gap-1.5" style={{ color: "var(--color-cyan)" }}>
            <Clock className="h-3 w-3" />
            <span className="text-[11px] font-mono">{section.readingTime}m</span>
          </div>
        </div>

        {/* Kicker rule — a thin category-coloured bar anchors the card. */}
        <div className="h-[2px] w-8 rounded-full mb-2.5" style={{ background: color, opacity: 0.75 }} />

        {/* Headline */}
        <h3
          className="text-base lg:text-lg font-semibold leading-snug text-foreground mb-2.5"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {section.headline}
        </h3>

        {/* Deck / standfirst — gold lead-in runway, with a fade-to-more when
            collapsed so the card visibly promises depth. */}
        <p
          className={cn(
            "text-[15px] lg:text-base leading-relaxed text-foreground/90 mb-3 flex-grow",
            isExpanded && "hidden",
            !isExpanded && "deck-clamp",
            !isExpanded && longDeck && "deck-fade"
          )}
        >
          {leadIn && (
            <span className="font-semibold" style={{ color: "var(--color-gold-rich)" }}>
              {leadIn}{" "}
            </span>
          )}
          {restSummary || (leadIn ? "" : summary)}
        </p>

        {/* Singapore Lens teaser — surfaces the analyst voice before expanding. */}
        {!isExpanded && lensTeaser && (
          <button
            onClick={() => setIsExpanded(true)}
            className="group text-left mb-3.5 pl-3 py-0.5 border-l-2 transition-colors"
            style={{ borderColor: "color-mix(in oklab, var(--color-cyan) 55%, transparent)" }}
          >
            <span
              className="block text-[10px] font-semibold tracking-[0.16em] uppercase mb-0.5"
              style={{ color: "var(--color-cyan)" }}
            >
              Singapore Lens
            </span>
            <span
              className="text-[13px] leading-snug"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist-dim)" }}
            >
              {lensTeaser}
            </span>
          </button>
        )}

        {/* Footer / CTA */}
        <div className="pt-3 border-t border-border/40 mt-auto">
          {!isExpanded ? (
            <>
              {section.sources?.length > 0 && (
                <p className="text-[11px] font-mono text-muted-foreground/60 truncate mb-2">
                  via {section.sources.map((s) => s.outlet).join(", ")}
                </p>
              )}
              <button
                onClick={() => setIsExpanded(true)}
                className="w-full flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 border border-[var(--color-cyan)]/40 bg-[var(--color-cyan)]/10 hover:bg-[var(--color-cyan)]/15 transition-colors"
              >
                <span
                  className="text-[12px] font-medium tracking-wide truncate"
                  style={{ color: "var(--color-mist-dim)" }}
                >
                  {ctaLabel}
                </span>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold shrink-0"
                  style={{ color: "var(--color-cyan)" }}
                >
                  Read more
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsExpanded(false)}
              className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 ml-auto shrink-0 transition-colors border text-muted-foreground/80 border-border hover:bg-white/5"
            >
              Show less
              <ChevronDown className="h-4 w-4 rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content — inset panel + accent to signal the drop-down */}
      {isExpanded && (
        <div className="border-t-2 border-[var(--color-cyan)]/30 bg-[var(--color-ink-well)] px-4 lg:px-5 pb-5 max-h-[500px] overflow-y-auto">
          {/* Editorial body — a "by the numbers" strip, a bright lede with a
              drop cap, the promoted analyst's note, then the gold prose broken
              by a lifted pull-quote. */}
          <div className="pt-4 mb-4 max-w-[64ch]">
            {/* By the numbers — metric strip (moved out of the collapsed face).
                Suppressed on the synthesis card, which is prose + signals only. */}
            {!isSystems && metrics.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {metrics.map((m: KeyMetric, i) => (
                  <div
                    key={i}
                    className="flex flex-col rounded-lg px-3 py-2 min-w-[88px] border border-border/40"
                    style={{ background: "var(--color-ink-raised)" }}
                  >
                    <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 mb-0.5">
                      {m.label}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-mono font-semibold text-foreground">{m.value}</span>
                      {m.change && (
                        <span
                          className="text-[10px] font-mono"
                          style={{
                            color:
                              m.direction === "up"
                                ? "var(--color-sage)"
                                : m.direction === "down"
                                  ? "var(--color-crimson)"
                                  : "var(--color-mist-faint)",
                          }}
                        >
                          {m.change}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(isSystems ? lensParts.body : section.paragraphs[0]) && (
              <p
                className="lede-para text-base leading-7 mb-4"
                style={{ color: "var(--color-mist)", ["--cap-color" as string]: color }}
              >
                {isSystems ? lensParts.body : section.paragraphs[0]}
              </p>
            )}

            {/* Remaining paragraphs, with the pull-quote lifted inline.
                Skipped for the synthesis section — its lede already holds the
                whole (signal-free) thesis, so re-rendering would duplicate it. */}
            {!isSystems && bodyParas.length > 0 && (
              <div className="space-y-4">
                {bodyParas.map((para, i) => {
                  const has = pullQuote && para.includes(pullQuote);
                  const text = has
                    ? para.replace(pullQuote!, "").replace(/\s{2,}/g, " ").trim()
                    : para;
                  return (
                    <Fragment key={i}>
                      {text && (
                        <p className="text-base leading-7" style={{ color: "var(--color-mist)" }}>
                          {text}
                        </p>
                      )}
                      {has && (
                        <blockquote
                          className="pull-quote"
                          style={{ ["--cap-color" as string]: color }}
                        >
                          {pullQuote}
                        </blockquote>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            )}

            {/* Synthesis "signals to watch" — the three forward signals pulled
                out of the systems prose as bullets (no Singapore Lens box). */}
            {isSystems && lensParts.watch.length > 0 && (
              <div className="lens-watch mt-5">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-gold-rich)" }} />
                  <p className="lens-watch-label">Signals to watch</p>
                </div>
                <ol className="watch-list">
                  {lensParts.watch.map((s, i) => (
                    <li key={i} className="watch-item">
                      <span className="watch-num">{i + 1}</span>
                      <p className="singapore-lens-text">{s}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Singapore Lens — the local angle, closing out the full story.
                Never on the synthesis card (it has its own signals block). */}
            {!isSystems && showLens && (
              <div className="singapore-lens mt-5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-cyan)" }} />
                  <p className="singapore-lens-label">Singapore Lens · Analyst's note</p>
                </div>
                {lensParts.body && <p className="singapore-lens-text">{lensParts.body}</p>}
                {lensParts.watch.length > 0 && (
                  <div className="lens-watch mt-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Eye className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-gold-rich)" }} />
                      <p className="lens-watch-label">
                        {lensParts.watch.length > 1 ? "Signals to watch" : "Signal to watch"}
                      </p>
                    </div>
                    {lensParts.watch.map((s, i) => (
                      <p key={i} className={cn("singapore-lens-text", i > 0 && "mt-2")}>{s}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hairline before the apparatus (tags + sources) */}
          <div className="border-t border-border/30 mb-4" />


          {/* Sources with link validation */}
          {section.sources?.length > 0 ? (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2" style={{ color: "var(--color-gold-rich)" }}>
                Sources
              </p>
              <div className="space-y-1.5">
                {section.sources.map((source, i) => {
                  const status = getStatus(source.url);
                  // Every link stays clickable — a server bot-check is not a
                  // browser, so we annotate rather than block.
                  const flagged = status === "broken";
                  return (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={status !== "loading" ? STATUS_TITLE[status] : undefined}
                      className={cn(
                        "flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-xs cursor-pointer",
                        "border transition-all hover:bg-white/5",
                        flagged
                          ? "border-crimson/20 bg-crimson/5 hover:border-crimson/35"
                          : "border-border/20 hover:border-border/40"
                      )}
                    >
                      <span className="shrink-0 mt-0.5">
                        <LinkStatusIcon status={status} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground/75 truncate">
                            {source.outlet}
                          </span>
                          <span className="ml-auto shrink-0 text-[11px] font-mono text-muted-foreground/40">
                            {source.date}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        </div>
                        {source.title && (
                          <p className="text-muted-foreground/50 text-[11px] leading-snug mt-0.5 line-clamp-2">
                            {source.title}
                          </p>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          ) : briefUrl ? (
            // No per-article sources — point to the canonical full brief.
            <a
              href={briefUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer border border-border/20 hover:bg-white/5 hover:border-border/40 transition-all"
            >
              <BookOpen className="h-3 w-3 shrink-0" style={{ color: "var(--color-cyan)" }} />
              <span className="flex-1 text-foreground/65">
                No inline sources — read the full brief
              </span>
              <ExternalLink className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
