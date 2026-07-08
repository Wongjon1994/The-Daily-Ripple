/**
 * RAG foundation (Agentic Ripple, Phase A). Embeds signals and per-section brief
 * chunks with OpenAI text-embedding-3-small into pgvector, and runs semantic
 * search + optional answer synthesis over them. All network calls are gated on
 * OPENAI_API_KEY (embeddings) / ANTHROPIC_API_KEY (synthesis) and no-op cleanly
 * when unset. The chunking and vector-literal helpers are pure and unit-tested.
 */

import { sql } from "drizzle-orm";

const MODEL = "text-embedding-3-small";
const DIM = 1536;
const BATCH = 96;

// ── pure helpers ─────────────────────────────────────────────────────────────

export interface BriefChunk {
  sectionIndex: number;
  category: string;
  chunkText: string;
}

/** One retrieval chunk per brief section (headline + body + Singapore Lens). */
export function chunkBrief(brief: any): BriefChunk[] {
  const sections = Array.isArray(brief?.sections) ? brief.sections : [];
  return sections
    .map((sec: any, i: number) => {
      const parts = [sec?.headline, ...(sec?.paragraphs || []), sec?.singaporeLens].filter(Boolean);
      return { sectionIndex: i, category: sec?.category || "", chunkText: parts.join("\n").trim() };
    })
    .filter((c: BriefChunk) => c.chunkText.length > 0);
}

/** Format a JS number[] as a pgvector literal: [0.1,0.2,…]. */
export function toVectorLiteral(v: number[]): string {
  return "[" + v.join(",") + "]";
}

function batches<T>(arr: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── OpenAI embeddings (gated) ────────────────────────────────────────────────

async function embed(texts: string[]): Promise<number[][]> {
  if (!process.env.OPENAI_API_KEY || texts.length === 0) return [];
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIM }),
  });
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json: any = await res.json();
  return (json.data || []).sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
}

// ── chunk persistence + embedding backfill ───────────────────────────────────

/** Upsert a brief's chunk rows (text only). Re-publishing updated content resets
 *  that chunk's embedding to NULL so it gets re-embedded. */
export async function upsertChunkRows(brief: any, dateSlug: string): Promise<number> {
  const chunks = chunkBrief(brief);
  if (chunks.length === 0) return 0;
  const { getDb } = await import("./db.js");
  const db = getDb();
  const now = Date.now();
  for (const c of chunks) {
    await db.execute(sql`
      INSERT INTO brief_chunks (brief_date_slug, section_index, category, chunk_text, created_at)
      VALUES (${dateSlug}, ${c.sectionIndex}, ${c.category}, ${c.chunkText}, ${now})
      ON CONFLICT (brief_date_slug, section_index) DO UPDATE SET
        chunk_text = EXCLUDED.chunk_text,
        category   = EXCLUDED.category,
        embedding  = CASE WHEN brief_chunks.chunk_text IS DISTINCT FROM EXCLUDED.chunk_text
                          THEN NULL ELSE brief_chunks.embedding END
    `);
  }
  return chunks.length;
}

async function embedMissing(table: "signals" | "brief_chunks", textCol: string): Promise<number> {
  if (!process.env.OPENAI_API_KEY) return 0;
  const { getDb } = await import("./db.js");
  const db = getDb();
  const rows = (await db.execute(
    sql`SELECT id, ${sql.raw(textCol)} AS t FROM ${sql.raw(table)} WHERE embedding IS NULL AND ${sql.raw(textCol)} <> '' LIMIT 1000`
  )).rows as any[];
  if (rows.length === 0) return 0;
  let done = 0;
  for (const batch of batches(rows)) {
    const vecs = await embed(batch.map((r) => String(r.t)));
    for (let i = 0; i < batch.length; i++) {
      if (!vecs[i]) continue;
      await db.execute(sql`UPDATE ${sql.raw(table)} SET embedding = ${toVectorLiteral(vecs[i])}::vector WHERE id = ${batch[i].id}`);
    }
    done += batch.length;
  }
  return done;
}

/** On-publish: upsert the brief's chunks and embed anything unembedded. */
export async function persistBriefChunks(brief: any, dateSlug: string): Promise<number> {
  await upsertChunkRows(brief, dateSlug);
  await embedMissing("brief_chunks", "chunk_text");
  await embedMissing("signals", "signal_text");
  return chunkBrief(brief).length;
}

/** One-off idempotent backfill: chunk every brief, then embed all missing rows. */
export async function backfillEmbeddings(): Promise<{ chunks: number; signals: number }> {
  if (!process.env.OPENAI_API_KEY) return { chunks: 0, signals: 0 };
  const { getAllBriefs } = await import("./db.js");
  const briefs = await getAllBriefs({ limit: 1000 });
  for (const b of briefs) await upsertChunkRows(b, (b as any).dateSlug);
  const chunks = await embedMissing("brief_chunks", "chunk_text");
  const signals = await embedMissing("signals", "signal_text");
  return { chunks, signals };
}

// ── semantic search + synthesis ──────────────────────────────────────────────

export interface SearchHit {
  type: "signal" | "brief";
  id: number;
  text: string;
  briefSlug: string;
  theme?: string;
  category?: string;
  status?: string;
  score: number;
}

/** Cosine top-K over signals + brief chunks. Retrieval only — ~$0 per query. */
export async function semanticSearch(query: string, k = 8): Promise<SearchHit[]> {
  if (!process.env.OPENAI_API_KEY || !query.trim()) return [];
  const [qv] = await embed([query]);
  if (!qv) return [];
  const lit = toVectorLiteral(qv);
  const { getDb } = await import("./db.js");
  const db = getDb();
  const sig = (await db.execute(sql`
    SELECT id, signal_text AS text, theme, brief_date_slug, status,
           1 - (embedding <=> ${lit}::vector) AS score
    FROM signals WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${lit}::vector LIMIT ${k}`)).rows as any[];
  const chk = (await db.execute(sql`
    SELECT id, chunk_text AS text, category, brief_date_slug,
           1 - (embedding <=> ${lit}::vector) AS score
    FROM brief_chunks WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${lit}::vector LIMIT ${k}`)).rows as any[];
  const merged: SearchHit[] = [
    ...sig.map((r) => ({ type: "signal" as const, id: r.id, text: r.text, theme: r.theme, briefSlug: r.brief_date_slug, status: r.status, score: Number(r.score) })),
    ...chk.map((r) => ({ type: "brief" as const, id: r.id, text: r.text, category: r.category, briefSlug: r.brief_date_slug, score: Number(r.score) })),
  ];
  return merged.sort((a, b) => b.score - a.score).slice(0, k);
}

const ANSWER_SYSTEM =
  "You are The Daily Ripple's intelligence analyst, writing for a Singapore professional. " +
  "Answer the question using ONLY the numbered context provided — cite sources inline as [n]. " +
  "Be concise and specific; lead with the answer. If the context is insufficient, say so plainly " +
  "rather than inventing detail.";

/** Opt-in ("Synthesize"): retrieve + Haiku answer with citations. Gated on
 *  ANTHROPIC_API_KEY; returns the retrieval hits regardless for citation UI. */
export async function synthesizeAnswer(query: string): Promise<{ answer: string; citations: SearchHit[] }> {
  const citations = await semanticSearch(query, 8);
  if (!process.env.ANTHROPIC_API_KEY || citations.length === 0) return { answer: "", citations };
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const context = citations
    .map((h, i) => `[${i + 1}] (${h.type}${h.briefSlug ? ` · ${h.briefSlug}` : ""}) ${h.text}`)
    .join("\n");
  const resp = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    system: ANSWER_SYSTEM,
    messages: [{ role: "user", content: `Question: ${query}\n\nContext:\n${context}` }],
  });
  const text = resp.content.find((b) => b.type === "text");
  return { answer: text && text.type === "text" ? text.text : "", citations };
}
