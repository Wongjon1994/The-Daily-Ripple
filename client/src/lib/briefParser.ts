/**
 * Brief Parser
 * Converts HTML brief content into structured dashboard schema
 * Handles extraction of sections, Singapore Lens, metrics, and metadata
 */

export interface BriefSource {
  outlet: string;
  title: string;
  date: string;
  url: string;
}

export interface KeyMetric {
  label: string;
  value: string;
  change?: string;
  direction?: "up" | "down" | "neutral";
}

export interface BriefSection {
  id: string; // "1" through "8"
  emoji: string;
  category: string;
  headline: string;
  summary: string;
  paragraphs: string[];
  singaporeLens: string | null;
  /** Optional forward-looking "signal to watch" note. If n8n emits this field
   *  it is used directly; otherwise it is derived from the Singapore Lens text
   *  by splitLensWatch(). */
  watch?: string | null;
  keyMetrics: KeyMetric[];
  readingTime: number;
  sources: BriefSource[];
  urgency: "high" | "medium" | "low";
  tags: string[];
}

export interface DailyBrief {
  date: string;
  greeting: string;
  teaser: string[];
  sections: BriefSection[];
  systemsSynthesis: {
    thesis: string;
    signals: string[];
  };
}

/**
 * Split a Singapore Lens into its analysis body and a forward-looking
 * "signal to watch" note.
 *
 * Daily n8n briefs close many section lenses with a forward signal flagged by
 * a leading "Watch" cue (e.g. "Watch Brent: if it clears $90, …"). This pulls
 * that trailing sentence out so the card can present it as a separate, labelled
 * "Watch" paragraph. The split is purely textual, so it applies automatically
 * to every future brief; if a section instead carries a structured `watch`
 * field, the caller should prefer that.
 *
 * Returns the lens unchanged as `body` with `watch: null` when no forward
 * signal is detected (or when splitting would leave no analysis behind).
 */
export function splitLensWatch(lens: string | null | undefined): {
  body: string;
  watch: string | null;
} {
  const text = (lens ?? "").trim();
  if (!text) return { body: "", watch: null };

  // Find a sentence that begins (at a sentence boundary) with "Watch …".
  const m = text.match(/(^|[.!?]["')\]]?\s+)(Watch\b[\s\S]*)$/);
  if (m && typeof m.index === "number") {
    const body = text.slice(0, m.index + m[1].length).trim();
    if (body) {
      // Drop the redundant leading "Watch" cue — the paragraph is labelled.
      let watch = m[2].trim().replace(/^Watch\b[:,]?\s*/i, "");
      watch = watch.charAt(0).toUpperCase() + watch.slice(1);
      return { body, watch };
    }
  }
  return { body: text, watch: null };
}

/**
 * Extract reading time from text (assumes 200 words per minute)
 */
function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 200);
}

/**
 * Extract Singapore Lens from paragraph 3
 * Looks for patterns like "🇸🇬 Singapore:" or "For Singapore,"
 */
function extractSingaporeLens(paragraph: string): string | null {
  // Look for Singapore-specific content
  const singaporePatterns = [
    /🇸🇬[^.!?]*[.!?]/,
    /For Singapore[^.!?]*[.!?]/i,
    /Singapore[^.!?]*(?:will|may|faces|needs)[^.!?]*[.!?]/i,
  ];

  for (const pattern of singaporePatterns) {
    const match = paragraph.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }

  // Fallback: extract first sentence mentioning Singapore
  const sentences = paragraph.split(/[.!?]+/);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes("singapore")) {
      return sentence.trim() + ".";
    }
  }

  return null;
}

/**
 * Extract key metrics from market/business sections
 * Looks for patterns like "S&P 500: 5,340 (↑ 1.2%)"
 */
function extractKeyMetrics(text: string): KeyMetric[] {
  const metrics: KeyMetric[] = [];
  
  // Pattern: "Label: Value (↑/↓ Change%)"
  const metricPattern = /([^:]+):\s*([^\(]+)\s*\(([↑↓])\s*([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = metricPattern.exec(text)) !== null) {
    metrics.push({
      label: match[1].trim(),
      value: match[2].trim(),
      change: match[4].trim(),
      direction: match[3] === "↑" ? "up" : "down",
    });
  }

  // Also look for standalone numbers with currency/units
  const numberPattern = /([A-Z][A-Za-z\s&]+?):\s*(\$?[\d,]+(?:\.\d+)?(?:%|bpd|K|M|B)?)/g;
  let numberMatch: RegExpExecArray | null;
  while ((numberMatch = numberPattern.exec(text)) !== null) {
    // Only add if not already captured
    if (numberMatch && !metrics.some((m) => m.label === numberMatch![1].trim())) {
      if (numberMatch) {
        metrics.push({
          label: numberMatch[1].trim(),
          value: numberMatch[2].trim(),
        });
      }
    }
  }

  return metrics;
}

/**
 * Parse sources from the sources registry block
 * Format: "1 | Reuters | Article Title | Date | URL"
 */
function parseSources(sourceBlock: string): BriefSource[] {
  const sources: BriefSource[] = [];
  const lines = sourceBlock.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length >= 5) {
      sources.push({
        outlet: parts[1],
        title: parts[2],
        date: parts[3],
        url: parts[4],
      });
    }
  }

  return sources;
}

/**
 * Extract section number and emoji from header
 * Format: "🌐 1. LEAD STORY — Headline"
 */
function parseHeader(header: string): {
  emoji: string;
  id: string;
  headline: string;
} {
  // Match emoji at start
  const emojiMatch = header.match(/^([🌐⚖️📊💼🤖🔬🎭🔗])\s+/);
  const emoji = emojiMatch ? emojiMatch[1] : "📰";

  // Extract section number (1-8)
  const numberMatch = header.match(/(\d+)\./);
  const id = numberMatch ? numberMatch[1] : "0";

  // Extract headline (everything after the dash)
  const headlineMatch = header.match(/—\s*(.+)$/);
  const headline = headlineMatch ? headlineMatch[1] : header;

  return { emoji, id, headline };
}

/**
 * Map category based on section number
 */
function getCategoryFromSection(sectionId: string): string {
  const categoryMap: Record<string, string> = {
    "1": "geopolitics",
    "2": "geopolitics",
    "3": "economics",
    "4": "business",
    "5": "ai-tech",
    "6": "science",
    "7": "culture",
    "8": "systems",
  };
  return categoryMap[sectionId] || "general";
}

/**
 * Determine urgency based on section and content
 */
function determineUrgency(sectionId: string, headline: string): "high" | "medium" | "low" {
  // Lead story is always high urgency
  if (sectionId === "1") return "high";

  // Check for urgency keywords
  const urgencyKeywords = ["crisis", "collapse", "surge", "plunge", "emergency", "alert"];
  if (urgencyKeywords.some((kw) => headline.toLowerCase().includes(kw))) {
    return "high";
  }

  // Sections 2-3 default to medium
  if (["2", "3"].includes(sectionId)) return "medium";

  return "low";
}

/**
 * Main parser function
 * Converts raw HTML brief into structured DailyBrief object
 */
export function parseBriefHTML(htmlContent: string): DailyBrief {
  // Extract date from title or first paragraph
  const dateMatch = htmlContent.match(/([A-Za-z]+\s+\d+,\s+\d{4})/);
  const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Extract greeting
  const greetingMatch = htmlContent.match(/<p[^>]*>([^<]*(?:morning|brief|intelligence)[^<]*)<\/p>/i);
  const greeting = greetingMatch ? greetingMatch[1] : "Good morning. Here is your daily intelligence brief.";

  // Extract teaser items
  const teaser: string[] = [];
  const teaserMatch = htmlContent.match(/<div[^>]*id="teaser"[^>]*>([\s\S]*?)<\/div>/i);
  if (teaserMatch) {
    const teaserContent = teaserMatch[1];
    const items = teaserContent.match(/<li[^>]*>([^<]+)<\/li>/g) || [];
    items.forEach((item) => {
      const text = item.replace(/<\/?li[^>]*>/g, "").trim();
      if (text) teaser.push(text);
    });
  }

  // Extract sources registry
  let allSources: BriefSource[] = [];
  const sourcesMatch = htmlContent.match(/<div[^>]*id="sources"[^>]*>([\s\S]*?)<\/div>/i);
  if (sourcesMatch) {
    allSources = parseSources(sourcesMatch[1]);
  }

  // Extract sections (1-8)
  const sections: BriefSection[] = [];
  const sectionPattern = /<h3[^>]*>([^<]+)<\/h3>([\s\S]*?)(?=<h3|<blockquote|$)/g;
  let sectionMatch: RegExpExecArray | null;
  const sectionMatches: Array<{ header: string; content: string }> = [];

  while ((sectionMatch = sectionPattern.exec(htmlContent)) !== null) {
    sectionMatches.push({
      header: sectionMatch[1],
      content: sectionMatch[2],
    });
  }

  for (const match of sectionMatches) {
    const { emoji, id, headline } = parseHeader(match.header);

    // Extract paragraphs
    const paragraphs: string[] = [];
    const pPattern = /<p[^>]*>([^<]+)<\/p>/g;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = pPattern.exec(match.content)) !== null) {
      paragraphs.push(pMatch[1].trim());
    }

    // Extract Singapore Lens from paragraph 3 (if exists)
    const singaporeLens = paragraphs[2] ? extractSingaporeLens(paragraphs[2]) : null;

    // Extract key metrics (especially for sections 3 and 4)
    const keyMetrics = extractKeyMetrics(match.content);

    // Get section-specific sources
    const sectionSources = allSources.filter((s) => s.outlet && s.title);

    // Calculate reading time
    const fullText = paragraphs.join(" ");
    const readingTime = estimateReadingTime(fullText);

    // Create summary from first 2 paragraphs
    const summary = paragraphs.slice(0, 2).join(" ").substring(0, 200);

    sections.push({
      id,
      emoji,
      category: getCategoryFromSection(id),
      headline,
      summary,
      paragraphs,
      singaporeLens,
      keyMetrics,
      readingTime,
      sources: sectionSources,
      urgency: determineUrgency(id, headline),
      tags: extractTags(headline),
    });
  }

  // Extract Systems Synthesis (section 8)
  let systemsSynthesis = {
    thesis: "",
    signals: [] as string[],
  };

  const synthesisSection = sections.find((s) => s.id === "8");
  if (synthesisSection && synthesisSection.paragraphs.length >= 2) {
    systemsSynthesis.thesis = synthesisSection.paragraphs[0];
    // Extract signals (sentences starting with "If")
    const signalText = synthesisSection.paragraphs[1];
    const signals = signalText.match(/If[^.!?]*[.!?]/g) || [];
    systemsSynthesis.signals = signals.map((s) => s.trim());
  }

  return {
    date,
    greeting,
    teaser,
    sections,
    systemsSynthesis,
  };
}

/**
 * Extract tags from headline
 */
function extractTags(headline: string): string[] {
  const tags: string[] = [];
  const tagKeywords = [
    "Taiwan",
    "China",
    "US",
    "Singapore",
    "Markets",
    "AI",
    "Tech",
    "Business",
    "Science",
    "Culture",
  ];

  for (const keyword of tagKeywords) {
    if (headline.toLowerCase().includes(keyword.toLowerCase())) {
      tags.push(keyword);
    }
  }

  return tags.slice(0, 3); // Limit to 3 tags
}

/**
 * Validate brief structure
 */
export function validateBrief(brief: DailyBrief): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!brief.date) errors.push("Missing date");
  if (!brief.greeting) errors.push("Missing greeting");
  if (brief.teaser.length === 0) errors.push("Missing teaser items");
  if (brief.sections.length !== 8) errors.push(`Expected 8 sections, got ${brief.sections.length}`);

  for (const section of brief.sections) {
    if (!section.headline) errors.push(`Section ${section.id}: Missing headline`);
    if (section.paragraphs.length === 0) errors.push(`Section ${section.id}: Missing paragraphs`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
