/**
 * Story detail (UX-revamp §6.4) — a dedicated, focused reading view for one
 * story, replacing the old in-page swipe carousel. Route: /brief/:slug/:story
 * (story is 1-based). A slim back/share bar stands in for the main header; the
 * body is a centered reading column with pulled-out stat tiles, short
 * paragraphs, a distinct Singapore Lens callout, and a link to Signals.
 */

import { useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft, Clock, ExternalLink, BookOpen, MapPin, Eye,
  Radar, CheckCircle2, XCircle, HelpCircle, ShieldAlert, Loader2,
} from "lucide-react";
import type { DailyBrief, BriefSection, KeyMetric } from "@/lib/briefParser";
import { partitionLensWatch, isSynthesisSection } from "@/lib/trendsAnalysis";
import { categoryColor, categoryLabel } from "@/lib/categories";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function rowToBrief(row: any): DailyBrief {
  return {
    date: row.date,
    greeting: row.greeting,
    teaser: Array.isArray(row.teaser) ? row.teaser : [],
    sections: Array.isArray(row.sections) ? row.sections : [],
    systemsSynthesis: row.systemsSynthesis ?? { thesis: "", signals: [] },
  };
}

/** A metric is worth showing only when it carries a real value, not a placeholder. */
function hasMetricValue(m: KeyMetric): boolean {
  const v = (m.value ?? "").trim();
  return v !== "" && v !== "—" && v !== "–" && v !== "-";
}

function normText(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

type LinkStatus = "ok" | "blocked" | "broken" | "unknown" | "loading";
const STATUS_TITLE: Record<Exclude<LinkStatus, "loading">, string> = {
  ok: "Link verified",
  blocked: "Site blocks automated checks — likely fine in your browser",
  broken: "Link may be dead (404)",
  unknown: "Could not verify",
};
function LinkStatusIcon({ status }: { status: LinkStatus }) {
  if (status === "loading")
    return <span className="w-3 h-3 rounded-full border border-border/50 border-t-[var(--color-cyan-dim)] animate-spin inline-block shrink-0" />;
  if (status === "ok") return <CheckCircle2 className="h-3 w-3 text-sage shrink-0" aria-label={STATUS_TITLE.ok} />;
  if (status === "broken") return <XCircle className="h-3 w-3 text-muted-foreground/45 shrink-0" aria-label={STATUS_TITLE.broken} />;
  if (status === "blocked") return <ShieldAlert className="h-3 w-3 text-muted-foreground/40 shrink-0" aria-label={STATUS_TITLE.blocked} />;
  return <HelpCircle className="h-3 w-3 text-muted-foreground/30 shrink-0" aria-label={STATUS_TITLE.unknown} />;
}

/** Pulled-out stat tiles (§6.4 / §7). Progressive enhancement: only renders when
 *  the section carries structured metrics with real values. */
function StatTiles({ metrics }: { metrics: KeyMetric[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-6">
      {metrics.map((m, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl px-3.5 py-3 border border-border/50"
          style={{ background: "var(--color-ink-raised)" }}
        >
          <span className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--color-mist-faint)" }}>
            {m.label}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-mono font-semibold" style={{ color: "var(--color-mist)" }}>{m.value}</span>
            {m.change && (
              <span
                className="text-[11px] font-mono"
                style={{
                  color:
                    m.direction === "up" ? "var(--color-sage)"
                    : m.direction === "down" ? "var(--color-crimson)"
                    : "var(--color-mist-faint)",
                }}
              >
                {m.direction === "up" ? "▲" : m.direction === "down" ? "▼" : ""} {m.change}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StoryTopBar({ backHref }: { backHref: string }) {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{
        height: "var(--nav-h)",
        borderColor: "color-mix(in oklab, var(--border) 80%, transparent)",
        background: "color-mix(in oklab, var(--background) 93%, transparent)",
      }}
    >
      <div className="container h-full flex items-center gap-2">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 -ml-1.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors hover:bg-white/5"
          style={{ color: "var(--color-mist-dim)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back to brief</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>
    </header>
  );
}

export default function StoryPage() {
  const params = useParams<{ slug: string; story: string }>();
  const [, navigate] = useLocation();
  const idx = Math.max(0, (parseInt(params.story ?? "1", 10) || 1) - 1);

  const { data: allRes, isLoading } = trpc.n8n.getAll.useQuery();
  const row = useMemo(
    () => (allRes?.briefs ?? []).find((r: any) => r.dateSlug === params.slug),
    [allRes, params.slug]
  );
  const brief = row ? rowToBrief(row) : null;
  const section: BriefSection | null = brief?.sections[idx] ?? null;
  const briefUrl: string | null = row?.telegraphUrl ?? null;
  const backHref = `/brief/${params.slug}`;

  const isSystems = section ? isSynthesisSection(section) : false;

  // Singapore Lens — dedicated field, falling back to paragraphs[2] by the
  // brief's authoring convention (same rule the old card used).
  const lensSource = useMemo(() => {
    if (!section) return "";
    const field = section.singaporeLens?.trim();
    if (field) return field;
    if (isSystems) return "";
    return section.paragraphs?.[2]?.trim() ?? "";
  }, [section, isSystems]);
  const showLens = !isSystems && !!lensSource;

  const lensParts = useMemo(
    () => partitionLensWatch(isSystems ? (section?.paragraphs.join("\n\n") ?? "") : lensSource, isSystems),
    [isSystems, section, lensSource]
  );

  const metrics = useMemo(
    () => (section?.keyMetrics ?? []).filter(hasMetricValue).slice(0, 6),
    [section]
  );

  // Body paragraphs after the lede; drop one that merely repeats the lens.
  const bodyParas = useMemo(() => {
    if (!section) return [];
    const paras = section.paragraphs?.slice(1) ?? [];
    const lensKey = normText(lensSource);
    if (!lensKey) return paras;
    return paras.filter((p) => {
      const pn = normText(p);
      return !(pn.includes(lensKey.slice(0, 50)) || lensKey.includes(pn.slice(0, 50)));
    });
  }, [section, lensSource]);

  const sourceUrls = useMemo(
    () => section?.sources?.map((s) => s.url).filter(Boolean) ?? [],
    [section]
  );
  const { data: linkData, isLoading: linksLoading } = trpc.n8n.validateLinks.useQuery(
    { urls: sourceUrls },
    { enabled: sourceUrls.length > 0, staleTime: 1000 * 60 * 10 }
  );
  const linkStatusMap = useMemo(() => {
    const m = new Map<string, LinkStatus>();
    for (const r of linkData?.results ?? []) m.set(r.url, r.status as LinkStatus);
    return m;
  }, [linkData]);
  const getStatus = (url: string): LinkStatus =>
    linksLoading ? "loading" : (linkStatusMap.get(url) ?? "unknown");

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: "var(--color-cyan-dim)" }} />
      </div>
    );
  }

  if (!brief || !section) {
    return (
      <div className="min-h-screen">
        <StoryTopBar backHref={backHref} />
        <div className="container py-24 text-center">
          <p style={{ color: "var(--color-mist-dim)" }}>That story isn't available.</p>
          <button
            onClick={() => navigate(backHref)}
            className="mt-4 text-sm font-semibold"
            style={{ color: "var(--color-cyan)" }}
          >
            ← Back to the brief
          </button>
        </div>
      </div>
    );
  }

  const isLead = section.id === "1";
  const color = categoryColor(section.category, isLead);
  const label = isLead ? "Lead story" : categoryLabel(section.category);
  const outlets = section.sources?.map((s) => s.outlet).filter(Boolean) ?? [];

  return (
    <div className="min-h-screen">
      <StoryTopBar backHref={backHref} />

      <main className="container py-8 sm:py-10">
        <article className="mx-auto" style={{ maxWidth: 700 }}>
          {/* Eyebrow: category + reading time */}
          <div className="flex items-center gap-2.5 mb-3">
            <span className="text-[11px] font-semibold tracking-[0.15em] uppercase" style={{ color }}>
              {label}
            </span>
            <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--color-mist-faint)" }} />
            <span className="flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--color-mist-faint)" }}>
              <Clock className="h-3 w-3" />
              {section.readingTime}m read
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-3xl sm:text-4xl font-bold leading-[1.1] mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "var(--color-mist)" }}
          >
            {section.headline}
          </h1>

          {/* Byline / meta */}
          {(outlets.length > 0 || brief.date) && (
            <p className="text-[13px] font-mono mb-1" style={{ color: "var(--color-mist-faint)" }}>
              {outlets.length > 0 && <>via {outlets.join(", ")} · </>}
              {brief.date}
            </p>
          )}
          <div className="h-[2px] w-10 rounded-full my-5" style={{ background: color, opacity: 0.8 }} />

          {/* Pulled-out stat tiles (progressive enhancement) */}
          {!isSystems && metrics.length > 0 && <StatTiles metrics={metrics} />}

          {/* Lede — drop cap */}
          {(isSystems ? lensParts.body : section.paragraphs[0]) && (
            <p
              className="lede-para text-lg leading-8 mb-5"
              style={{ color: "var(--color-mist)", ["--cap-color" as string]: color }}
            >
              {isSystems ? lensParts.body : section.paragraphs[0]}
            </p>
          )}

          {/* Body */}
          {!isSystems && bodyParas.length > 0 && (
            <div className="space-y-5">
              {bodyParas.map((para, i) => (
                <p key={i} className="text-[17px] leading-8" style={{ color: "var(--color-mist)" }}>
                  {para}
                </p>
              ))}
            </div>
          )}

          {/* Synthesis "signals to watch" */}
          {isSystems && lensParts.watch.length > 0 && (
            <div className="lens-watch mt-7">
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

          {/* Singapore Lens callout — distinct from body prose (§6.4 / punch-list) */}
          {showLens && (
            <div className="singapore-lens mt-7">
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

          {/* Link to the related signal layer */}
          <Link
            href="/signals"
            className="group flex items-center gap-2.5 mt-7 rounded-xl px-4 py-3 border transition-colors"
            style={{
              borderColor: "color-mix(in oklab, var(--color-cyan) 35%, transparent)",
              background: "color-mix(in oklab, var(--color-cyan) 8%, transparent)",
            }}
          >
            <Radar className="h-4 w-4 shrink-0" style={{ color: "var(--color-cyan)" }} />
            <span className="text-[13px]" style={{ color: "var(--color-mist-dim)" }}>
              Track how this plays out in <span className="font-semibold" style={{ color: "var(--color-cyan)" }}>Signals</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0 opacity-60" style={{ color: "var(--color-cyan)" }} />
          </Link>

          {/* Sources */}
          <div className="mt-8 pt-6 border-t border-border/40">
            {section.sources?.length > 0 ? (
              <>
                <p className="text-[10px] font-semibold tracking-[0.12em] uppercase mb-2.5" style={{ color: "var(--color-gold-rich)" }}>
                  Sources
                </p>
                <div className="space-y-1.5">
                  {section.sources.map((source, i) => {
                    const status = getStatus(source.url);
                    return (
                      <a
                        key={i}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={status !== "loading" ? STATUS_TITLE[status] : undefined}
                        className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs border border-border/20 transition-all hover:bg-white/5 hover:border-border/40"
                      >
                        <span className="shrink-0 mt-0.5"><LinkStatusIcon status={status} /></span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground/75 truncate">{source.outlet}</span>
                            <span className="ml-auto shrink-0 text-[11px] font-mono text-muted-foreground/40">{source.date}</span>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                          </div>
                          {source.title && (
                            <p className="text-muted-foreground/50 text-[11px] leading-snug mt-0.5 line-clamp-2">{source.title}</p>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </>
            ) : briefUrl ? (
              <a
                href={briefUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs border border-border/20 hover:bg-white/5 hover:border-border/40 transition-all"
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-cyan)" }} />
                <span className="flex-1 text-foreground/65">No inline sources — read the full brief</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              </a>
            ) : null}

            {/* Canonical full brief (Telegraph) — never dropped */}
            {briefUrl && section.sources?.length > 0 && (
              <a
                href={briefUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-[13px] font-semibold rounded-lg px-3.5 py-2 transition-colors"
                style={{
                  color: "var(--color-cyan)",
                  border: "1px solid color-mix(in oklab, var(--color-cyan) 45%, transparent)",
                  background: "color-mix(in oklab, var(--color-cyan) 10%, transparent)",
                }}
              >
                Read the full brief
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
