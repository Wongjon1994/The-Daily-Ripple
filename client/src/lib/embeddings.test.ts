import { describe, it, expect } from "vitest";
import { chunkBrief, toVectorLiteral } from "../../../server/embeddings";

/**
 * Unit tests for the pure RAG helpers (Agentic Ripple, Phase A). The OpenAI /
 * Anthropic / pgvector paths are key-gated and exercised against the deployment.
 */

describe("chunkBrief", () => {
  const brief = {
    sections: [
      { headline: "MAS holds policy", category: "economics", paragraphs: ["Para one.", "Para two."], singaporeLens: "For Singapore, watch the slope." },
      { headline: "Empty section", category: "culture", paragraphs: [] },
      { headline: "Systems", category: "systems", paragraphs: ["Thesis."], singaporeLens: null },
    ],
  };

  it("makes one chunk per non-empty section with headline + body + lens", () => {
    const chunks = chunkBrief(brief);
    expect(chunks.length).toBe(3); // section 2 has only a headline → still non-empty
    expect(chunks[0].sectionIndex).toBe(0);
    expect(chunks[0].category).toBe("economics");
    expect(chunks[0].chunkText).toContain("MAS holds policy");
    expect(chunks[0].chunkText).toContain("Para two.");
    expect(chunks[0].chunkText).toContain("watch the slope");
  });

  it("drops sections with no text at all", () => {
    const chunks = chunkBrief({ sections: [{ category: "x", paragraphs: [] }] });
    expect(chunks).toEqual([]);
  });

  it("handles a malformed brief", () => {
    expect(chunkBrief({})).toEqual([]);
    expect(chunkBrief(null)).toEqual([]);
  });
});

describe("toVectorLiteral", () => {
  it("formats a pgvector literal", () => {
    expect(toVectorLiteral([0.1, -0.2, 0.3])).toBe("[0.1,-0.2,0.3]");
  });
});
