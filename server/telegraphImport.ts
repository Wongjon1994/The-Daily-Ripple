/**
 * telegraphImport.ts — build a structured DailyBrief from a published Telegraph
 * page. Mirrors scripts/import-telegraph.mjs but returns the brief object (for
 * the /api/publish-telegraph endpoint) instead of writing a .ts file.
 *
 * The n8n workflow publishes the brief to Telegraph, then POSTs the resulting
 * URL here; the server fetches and parses it into the dashboard's schema.
 */

import type { InsertBrief } from "../drizzle/schema.js";

type Node = string | { tag?: string; attrs?: { href?: string }; children?: Node[] };

const EMOJI_CATEGORY: Record<string, string> = {
  "🌐": "geopolitics", "⚖️": "geopolitics", "📊": "economics", "💼": "business",
  "🤖": "ai-tech", "🔬": "science", "🎭": "culture", "🔗": "systems",
};
const LABEL_CATEGORY: [RegExp, string][] = [
  [/SYSTEMS/i, "systems"], [/CULTURE/i, "culture"], [/SCIENCE|HEALTH/i, "science"],
  [/AI|TECHNOLOGY/i, "ai-tech"], [/BUSINESS/i, "business"],
  [/MARKET|ECONOMIC/i, "economics"], [/GLOBAL POWER|POLICY|LEAD/i, "geopolitics"],
];
const CATEGORY_TAGS: Record<string, string[]> = {
  geopolitics: ["Geopolitics"], economics: ["Markets", "Economics"], business: ["Business"],
  "ai-tech": ["AI", "Technology"], science: ["Science", "Health"], culture: ["Culture"],
  systems: ["Systems", "Synthesis"],
};
const CATEGORY_URGENCY: Record<string, string> = {
  geopolitics: "high", economics: "medium", business: "medium",
  "ai-tech": "medium", science: "medium", culture: "low", systems: "medium",
};

const text = (n: Node): string =>
  typeof n === "string" ? n : (n.children || []).map(text).join("");
const hasLink = (n: Node): boolean =>
  typeof n === "object" && (n.tag === "a" || (n.children || []).some(hasLink));
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

function distill(s: string, maxLen = 220): string {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (lastStop > 60) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function parseSources(ul: Node) {
  const out: { outlet: string; title: string; url: string; date: string }[] = [];
  for (const li of (typeof ul === "object" && ul.children) || []) {
    if (typeof li !== "object") continue;
    let pre = "";
    for (const child of li.children || []) {
      if (typeof child === "string") { pre += child; continue; }
      if (child.tag === "a") {
        const url = child.attrs?.href;
        const title = text(child).trim();
        const m = pre.match(/([^.]*(?:\.[^.(]*)*?)\s*\(([^)]+)\)\.?\s*$/);
        let outlet = (m ? m[1] : pre).trim().replace(/[.\s]+$/, "");
        let d = m ? m[2].trim() : "";
        const dm = d.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
        const MON: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
        if (dm) d = `${MON[dm[2]] || dm[2]} ${+dm[1]}, ${dm[3]}`;
        if (url) out.push({ outlet: outlet || "Source", title, url, date: d });
        pre = "";
      } else pre += text(child);
    }
  }
  return out;
}

function cleanMetricValue(rawValue: string): string | null {
  const v = rawValue.split("(")[0].trim().replace(/[,;]\s*$/, "");
  if (/\d/.test(v)) {
    if (v.length <= 22) return v;
    const m = v.match(/[$~]?\s?\d[\d,.]*\s?(%|\/barrel|\/bbl|bps|bn|billion|trillion|pts|points)?/i);
    return m ? m[0].trim() : v.slice(0, 22).trim();
  }
  return v.length <= 18 ? v : null;
}

function parseMetrics(ul: Node) {
  const out: { label: string; value: string; change?: string; direction: string }[] = [];
  for (const li of (typeof ul === "object" && ul.children) || []) {
    const raw = text(li).trim();
    const m = raw.match(/^(.+?):\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const rest = m[2].trim();
    if (/\b(no\s+(verified|available)|not\s+available|no\s+data|n\/a|unavailable)\b/i.test(rest)) continue;
    const value = cleanMetricValue(rest);
    if (value === null) continue;
    const paren = (rest.match(/\(([^)]*)\)/) || [])[1] || "";
    const change = (paren.match(/[+\-–−]?\d+(?:\.\d+)?%/) || [])[0];
    let direction = "neutral";
    if (/[+]|\bup\b|\brose\b|\bgain/i.test(paren) || /^\+/.test(change || "")) direction = "up";
    if (/[–−-]|\bdown\b|\bfell\b|\bdrop|\bloss/i.test(paren)) direction = "down";
    const metric: any = { label, value };
    if (change) metric.change = change.replace(/[–−]/g, "-");
    metric.direction = direction;
    out.push(metric);
  }
  return out;
}

function parseHeader(h: string) {
  const m = h.match(/^(\S+)\s+(?:\d+\.\s*)?(.+?)\s*[—–]\s*(.+)$/);
  if (!m) return null;
  return { emoji: m[1], label: m[2].trim(), headline: m[3].trim() };
}

/** Parse Telegraph node content into the dashboard's section schema. */
function buildSections(content: Node[]) {
  const sections: any[] = [];
  let cur: any = null;
  let synthesisText = "";

  const pushParagraph = (node: Node) => {
    const txt = text(node).trim();
    if (!cur || !txt || txt.startsWith("📎")) return;
    cur.paragraphs.push(txt);
  };

  for (const node of content) {
    if (typeof node !== "object") continue;
    const tag = node.tag;
    if (tag === "h3") {
      const raw = text(node);
      if (/systems\s+synthesis/i.test(raw)) { cur = null; continue; }
      const hd = parseHeader(raw);
      if (!hd) continue;
      const category = EMOJI_CATEGORY[hd.emoji] || (LABEL_CATEGORY.find(([re]) => re.test(hd.label)) || [, "geopolitics"])[1];
      cur = { ...hd, num: sections.length + 1, category, paragraphs: [], keyMetrics: [], sources: [] };
      sections.push(cur);
    } else if (tag === "p") {
      pushParagraph(node);
    } else if (tag === "ul" && cur) {
      if (hasLink(node)) cur.sources.push(...parseSources(node));
      else cur.keyMetrics.push(...parseMetrics(node));
    } else if (tag === "blockquote") {
      const t = text(node).replace(/^🔗?\s*\d*\.?\s*SYSTEMS SYNTHESIS/i, "").trim();
      if (t && !t.startsWith("📎")) {
        synthesisText = synthesisText ? `${synthesisText} ${t}` : t;
      }
    }
  }

  const buildSection = (s: any) => {
    let paragraphs: string[] = s.paragraphs;
    const lastPara = paragraphs[paragraphs.length - 1] || "";
    let singaporeLens: string | null = null;
    if (/singapore/i.test(lastPara)) {
      singaporeLens = lastPara;
      if (paragraphs.length > 1) paragraphs = paragraphs.slice(0, -1);
    }
    const body = paragraphs.join(" ");
    return {
      id: String(s.num),
      emoji: s.emoji,
      category: s.category,
      headline: s.headline,
      summary: distill(paragraphs[0] || s.headline, 200),
      paragraphs,
      singaporeLens,
      keyMetrics: s.keyMetrics,
      readingTime: Math.max(2, Math.round((wordCount(body) + wordCount(singaporeLens || "")) / 200)),
      sources: s.sources,
      urgency: s.num === 1 ? "high" : (CATEGORY_URGENCY[s.category] || "medium"),
      tags: CATEGORY_TAGS[s.category] || [],
    };
  };

  const builtSections = sections.map(buildSection);

  if (synthesisText) {
    const paras = synthesisText
      .split(/(?=Three conditional signals|Here are three|Two signals|Three signals to watch|The thread is this)/i)
      .map((x) => x.trim()).filter(Boolean);
    const lens = (synthesisText.match(/[^.]*Singapore[^.]*\.(?:[^.]*\.)?/i) || [])[0] || null;
    builtSections.push({
      id: "8", emoji: "🔗", category: "systems",
      headline: "Systems synthesis — the hidden thread connecting today's stories",
      summary: distill(synthesisText, 200),
      paragraphs: paras.length ? paras : [synthesisText],
      singaporeLens: lens,
      keyMetrics: [], readingTime: Math.max(2, Math.round(wordCount(synthesisText) / 200)),
      sources: [], urgency: "medium", tags: ["Systems", "Synthesis"],
    });
  }

  return { builtSections, synthesisText };
}

/** Today's date in Singapore (or an explicit yyyy-mm-dd override) in all three forms. */
function sgtDate(override?: string) {
  const d = override && /^\d{4}-\d{2}-\d{2}$/.test(override)
    ? new Date(`${override}T12:00:00+08:00`)
    : new Date();
  const part = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Singapore", ...opts }).format(d);
  const y = part({ year: "numeric" });
  const mm = part({ month: "2-digit" });
  const dd = part({ day: "2-digit" });
  const monthLong = part({ month: "long" });
  const day = String(parseInt(dd, 10));
  return {
    date: `${monthLong} ${day}, ${y}`,
    briefDate: `${y}-${mm}-${dd}`,
    dateSlug: `${monthLong.toLowerCase()}-${day}-${y}`,
  };
}

/** Resolve a telegra.ph page path from a telegra.ph URL or a redirecting shortlink. */
async function resolveTelegraphPath(url: string): Promise<string> {
  const direct = url.match(/telegra\.ph\/([^/?#\s]+)/i);
  if (direct) return direct[1];
  const res = await fetch(url, { redirect: "follow" });
  const final = res.url.match(/telegra\.ph\/([^/?#\s]+)/i);
  if (final) return final[1];
  throw new Error(`Could not resolve a telegra.ph path from: ${url}`);
}

/**
 * Fetch a published Telegraph brief and return the upsert-ready DailyBrief row.
 * `date` (yyyy-mm-dd) is optional — defaults to today in Singapore.
 */
export async function briefFromTelegraph(input: { url?: string; date?: string }): Promise<InsertBrief> {
  if (!input?.url) throw new Error("Missing `url` (the published Telegraph page).");
  const path = await resolveTelegraphPath(input.url.trim());
  const apiRes = await fetch(`https://api.telegra.ph/getPage/${path}?return_content=true`);
  const json = (await apiRes.json()) as any;
  if (!json?.ok || !json?.result?.content) {
    throw new Error(`Telegraph getPage failed for "${path}": ${JSON.stringify(json?.error ?? json)}`);
  }
  const content: Node[] = json.result.content;
  const telegraphUrl: string = json.result.url || `https://telegra.ph/${path}`;

  const { builtSections, synthesisText } = buildSections(content);
  if (builtSections.length === 0) throw new Error("No sections parsed from the Telegraph page.");

  const { date, briefDate, dateSlug } = sgtDate(input.date);

  return {
    date,
    dateSlug,
    briefDate,
    greeting: "Good morning. Here is your daily intelligence brief.",
    teaser: builtSections.slice(0, 3).map((s) => s.headline),
    sections: builtSections as any,
    systemsSynthesis: { thesis: synthesisText ? distill(synthesisText, 300) : "", signals: [] },
    telegraphUrl,
    rawPayload: null,
  };
}
