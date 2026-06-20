/**
 * import-telegraph.mjs — convert a published Telegraph brief into a DailyBrief .ts file.
 *
 * Usage:
 *   node scripts/import-telegraph.mjs <telegraph-path> <date> <dateSlug> <varName> <telegraphUrl>
 * Example:
 *   node scripts/import-telegraph.mjs The-Daily-Ripple-06-06 "June 6, 2026" june-6-2026 jun6Brief https://linkly.link/2kBcC
 *
 * WHY THIS EXISTS / n8n NOTE:
 *   Telegraph is a *lossy rendering* of a brief. It reliably carries headline,
 *   paragraphs, sources, and (sometimes) a metrics list. It does NOT carry the
 *   dashboard's derived fields — summary, singaporeLens, keyMetrics labels, tags,
 *   urgency, readingTime, teaser, greeting, systemsSynthesis. This script derives
 *   those with heuristics. For the future n8n pipeline the cleaner contract is to
 *   POST the *full structured DailyBrief JSON* to /api/publish (the generating LLM
 *   emits the schema directly) rather than reverse-engineering it from Telegraph.
 */

import { writeFileSync } from "fs";

const [, , path, date, dateSlug, varName, telegraphUrl] = process.argv;
if (!path || !date || !dateSlug || !varName) {
  console.error("usage: import-telegraph.mjs <path> <date> <dateSlug> <varName> [telegraphUrl]");
  process.exit(1);
}

// ── emoji → category, and label → category fallback ───────────────────────────
const EMOJI_CATEGORY = {
  "🌐": "geopolitics", "⚖️": "geopolitics", "📊": "economics", "💼": "business",
  "🤖": "ai-tech", "🔬": "science", "🎭": "culture", "🔗": "systems",
};
const LABEL_CATEGORY = [
  [/SYSTEMS/i, "systems"], [/CULTURE/i, "culture"], [/SCIENCE|HEALTH/i, "science"],
  [/AI|TECHNOLOGY/i, "ai-tech"], [/BUSINESS/i, "business"],
  [/MARKET|ECONOMIC/i, "economics"], [/GLOBAL POWER|POLICY|LEAD/i, "geopolitics"],
];
const CATEGORY_TAGS = {
  geopolitics: ["Geopolitics"], economics: ["Markets", "Economics"], business: ["Business"],
  "ai-tech": ["AI", "Technology"], science: ["Science", "Health"], culture: ["Culture"],
  systems: ["Systems", "Synthesis"],
};
const CATEGORY_URGENCY = {
  geopolitics: "high", economics: "medium", business: "medium",
  "ai-tech": "medium", science: "medium", culture: "low", systems: "medium",
};

// ── tiny helpers ──────────────────────────────────────────────────────────────
const text = (n) => (typeof n === "string" ? n : (n.children || []).map(text).join(""));
const hasLink = (n) => typeof n === "object" && (n.tag === "a" || (n.children || []).some(hasLink));

/** first 1–2 sentences, capped at ~maxLen, ending on a sentence boundary */
function distill(s, maxLen = 220) {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  if (lastStop > 60) return cut.slice(0, lastStop + 1).trim();
  // No sentence boundary in range — break on the last whole word, never mid-word.
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

/** parse a sources <ul>; one <li> may concatenate several "Outlet. (date). <a>" entries */
function parseSources(ul) {
  const out = [];
  for (const li of ul.children || []) {
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
        // normalise "5 Jun 2026" → "June 5, 2026"
        const dm = d.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
        const MON = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
        if (dm) d = `${MON[dm[2]] || dm[2]} ${+dm[1]}, ${dm[3]}`;
        if (url) out.push({ outlet: outlet || "Source", title, url, date: d });
        pre = "";
      } else pre += text(child);
    }
  }
  return out;
}

/**
 * Reduce a data-list value to a concise figure. A keyMetric must read as a
 * number/short label ("$87/bbl", "7,394", "Record close") — never a sentence.
 * Returns null when the value is prose with no figure, so the metric is dropped.
 */
function cleanMetricValue(rawValue) {
  const v = rawValue.split("(")[0].trim().replace(/[,;]\s*$/, "");
  if (/\d/.test(v)) {
    if (v.length <= 22) return v;                       // already concise
    const m = v.match(/[$~]?\s?\d[\d,.]*\s?(%|\/barrel|\/bbl|bps|bn|billion|trillion|pts|points)?/i);
    return m ? m[0].trim() : v.slice(0, 22).trim();      // pull the figure out of prose
  }
  return v.length <= 18 ? v : null;                      // short qualitative ok; prose dropped
}

/** parse a metrics DATA <ul>: "S&P 500: ~7,427 (–2.0%, Friday close)" */
function parseMetrics(ul) {
  const out = [];
  for (const li of ul.children || []) {
    const raw = text(li).trim();
    const m = raw.match(/^(.+?):\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim();
    const rest = m[2].trim();
    // skip non-data placeholders the source sometimes leaves in
    if (/\b(no\s+(verified|available)|not\s+available|no\s+data|n\/a|unavailable)\b/i.test(rest)) continue;
    const value = cleanMetricValue(rest);
    if (value === null) continue;                        // prose, not a metric
    const paren = (rest.match(/\(([^)]*)\)/) || [])[1] || "";
    const change = (paren.match(/[+\-–−]?\d+(?:\.\d+)?%/) || [])[0];
    let direction = "neutral";
    if (/[+]|\bup\b|\brose\b|\bgain/i.test(paren) || /^\+/.test(change || "")) direction = "up";
    if (/[–−-]|\bdown\b|\bfell\b|\bdrop|\bloss/i.test(paren)) direction = "down";
    const metric = { label, value };
    if (change) metric.change = change.replace(/[–−]/g, "-");
    metric.direction = direction;
    out.push(metric);
  }
  return out;
}

function parseHeader(h) {
  // "🌐 1. LEAD STORY — <headline>"  — the "1." number is optional (some
  // sections publish as "💼 BUSINESS — …"). Section order is assigned by
  // position later, so a missing number must not drop the section.
  const m = h.match(/^(\S+)\s+(?:\d+\.\s*)?(.+?)\s*[—–]\s*(.+)$/u);
  if (!m) return null;
  return { emoji: m[1], label: m[2].trim(), headline: m[3].trim() };
}

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

// ── fetch + walk ──────────────────────────────────────────────────────────────
const api = `https://api.telegra.ph/getPage/${path}?return_content=true`;
const res = await fetch(api);
const content = (await res.json()).result.content;

const sections = [];
let cur = null;
let synthesisText = "";

function pushParagraph(node) {
  const txt = text(node).trim();
  if (!cur || !txt || txt.startsWith("📎")) return;
  cur.paragraphs.push(txt);
}

for (const node of content) {
  if (typeof node !== "object") continue;
  const tag = node.tag;
  if (tag === "h3") {
    const raw = text(node);
    // The §8 "SYSTEMS SYNTHESIS" heading has no "—" headline and is followed by
    // blockquotes. Close the current section so the synthesis blockquotes and
    // its sources list don't get attached to the previous story (e.g. Culture).
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
    // §8 systems synthesis is published as one or more blockquotes. ACCUMULATE
    // them (some briefs split it across several) and skip the trailing
    // "📎 Sources" marker blockquote — otherwise it would overwrite the prose.
    const t = text(node).replace(/^🔗?\s*\d*\.?\s*SYSTEMS SYNTHESIS/i, "").trim();
    if (t && !t.startsWith("📎")) {
      synthesisText = synthesisText ? `${synthesisText} ${t}` : t;
    }
  }
}

// ── assemble DailyBrief sections ──────────────────────────────────────────────
function buildSection(s) {
  // The Singapore angle is the trailing paragraph. Use it *in full* as the lens
  // (never truncated) and lift it out of the body so it isn't shown twice.
  let paragraphs = s.paragraphs;
  const lastPara = paragraphs[paragraphs.length - 1] || "";
  let singaporeLens = null;
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
}

const builtSections = sections.map(buildSection);

// append §8 systems-synthesis section if present
if (synthesisText) {
  const paras = synthesisText.split(/(?=Three conditional signals|Here are three|Two signals|Three signals to watch|The thread is this)/i).map((x) => x.trim()).filter(Boolean);
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

const brief = {
  date,
  greeting: "Good morning. Here is your daily intelligence brief.",
  teaser: builtSections.slice(0, 3).map((s) => s.headline),
  sections: builtSections,
  systemsSynthesis: {
    thesis: synthesisText ? distill(synthesisText, 300) : "",
    signals: [],
  },
};

const out = `import type { DailyBrief } from "./briefParser";\n\nexport const ${varName}: DailyBrief = ${JSON.stringify(brief, null, 2)};\n`;
const outPath = `briefs-json-export/${varName}.ts`;
writeFileSync(outPath, out);

const srcCounts = builtSections.map((s) => s.sources.length);
const metricCounts = builtSections.map((s) => s.keyMetrics.length);
console.log(`✓ ${varName}: ${builtSections.length} sections → ${outPath}`);
console.log(`  sources/section:  ${srcCounts.join(",")}`);
console.log(`  metrics/section:  ${metricCounts.join(",")}`);
console.log(`  lens present:     ${builtSections.map((s) => (s.singaporeLens ? "Y" : "-")).join(",")}`);
