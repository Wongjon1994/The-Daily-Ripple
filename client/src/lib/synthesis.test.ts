import { describe, it, expect } from "vitest";
import { buildThemeInputs, formatEntries, cachedUserContent } from "../../../server/synthesis";

/**
 * Unit tests for the pure synthesis input-construction (Trends Part 2, Addendum B).
 * The Sonnet calls and runSynthesis are key-gated and exercised at runtime.
 */

const mk = (date: string, sections: any[]) => ({ date, briefDate: date, sections });

const briefs = [
  mk("2026-06-20", [
    { headline: "China Taiwan military drills", category: "Geopolitics", singaporeLens: "Singapore recalibrates defence posture amid regional tension." },
    { headline: "Nvidia chip demand", category: "Tech", singaporeLens: "Local semiconductor services see a data-centre uplift." },
  ]),
  mk("2026-06-23", [
    { headline: "Russia Ukraine front shifts", category: "Geopolitics", singaporeLens: "MFA weighs Singapore's neutral diplomatic position." },
  ]),
  mk("2026-06-27", [
    { headline: "Israel Iran escalation", category: "Geopolitics", singaporeLens: "Singapore navy steps up patrols." },
    { headline: "Broadcom AI cloud", category: "Tech", singaporeLens: "Watch MOM job-vacancy data for white-collar roles." },
  ]),
];

describe("buildThemeInputs (1W)", () => {
  const out = buildThemeInputs(briefs, "1W");

  it("groups Singapore Lens entries by theme, chronologically", () => {
    const geo = out.themes.find((t) => t.theme === "geopolitics")!;
    expect(geo).toBeDefined();
    expect(geo.entries.map((e) => e.date)).toEqual(["2026-06-20", "2026-06-23", "2026-06-27"]);
    expect(geo.briefCount).toBe(3);
  });

  it("counts distinct briefs per theme", () => {
    const tech = out.themes.find((t) => t.theme === "ai_tech")!;
    expect(tech.briefCount).toBe(2); // Jun 20 + Jun 27
  });

  it("orders themes by briefCount and names the dominant", () => {
    expect(out.themes[0].theme).toBe("geopolitics");
    expect(out.dominant).toBe("geopolitics");
  });

  it("reports the window bounds", () => {
    expect(out.windowStart).toBe("2026-06-20");
    expect(out.windowEnd).toBe("2026-06-27");
  });

  it("skips sections without a Singapore Lens", () => {
    const out2 = buildThemeInputs(
      [mk("2026-06-27", [{ headline: "x", category: "Systems", paragraphs: ["no lens"] }])],
      "1W"
    );
    expect(out2.themes).toEqual([]);
    expect(out2.dominant).toBeNull();
  });
});

describe("cachedUserContent", () => {
  it("puts the cache breakpoint on the shared prefix, not the instruction", () => {
    const content = cachedUserContent("HEADER", "\n\nINSTRUCTION");
    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({ type: "text", text: "HEADER", cache_control: { type: "ephemeral" } });
    expect(content[1]).toEqual({ type: "text", text: "\n\nINSTRUCTION" });
    expect("cache_control" in content[1]).toBe(false);
  });

  it("concatenates to the exact original single-string prompt", () => {
    const content = cachedUserContent("base", "\n\ninstruction");
    expect(content.map((b) => b.text).join("")).toBe("base\n\ninstruction");
  });
});

describe("formatEntries", () => {
  it("renders dated, chronological lens blocks", () => {
    const text = formatEntries([
      { date: "2026-06-20", headline: "A", lens: "First." },
      { date: "2026-06-27", headline: "B", lens: "Second." },
    ]);
    expect(text).toBe("[2026-06-20] A:\nFirst.\n\n[2026-06-27] B:\nSecond.");
  });
});
