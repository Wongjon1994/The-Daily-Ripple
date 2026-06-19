import { describe, it, expect } from "vitest";
import { parseBriefHTML, validateBrief } from "./briefParser";

describe("Brief Parser", () => {
  const sampleHTML = `
    <div id="sources">
    1 | Reuters | Singapore economy grows 6.0% year-on-year in Q1 2026 | 25 May 2026 | https://www.reuters.com/world/asia-pacific/singapore-economy-grows-6-yy-q1-above-advance-estimate-2026-05-25/
    2 | Bloomberg | US-China trade talks intensify | 31 May 2026 | https://www.bloomberg.com/news/articles/2026-05-31-us-china-trade
    </div>

    <div id="teaser">
    <li>Taiwan security downgraded to negotiating chip in US-China talks</li>
    <li>3.5 million Americans lose food stamp benefits as Trump bill takes effect</li>
    <li>S&P 500 hits record high amid oil price collapse</li>
    </div>

    <h3>🌐 1. LEAD STORY — Taiwan Omitted at Shangri-La Dialogue</h3>
    <p>US Defence Secretary Pete Hegseth addressed the Shangri-La Dialogue in Singapore without mentioning Taiwan. This marks a striking departure from prior US defence secretaries.</p>
    <p>Trump described a USD 14 billion arms package for Taiwan as "a very good negotiating chip" with Beijing. The silence on Taiwan will reverberate across Southeast Asian foreign ministries.</p>
    <p>For Singapore, the Shangri-La Dialogue is not just a conference we host — it's a barometer we read carefully. 🇸🇬 SGX banking exposure: DBS, OCBC, UOB all have material Greater China exposure. If the US is trading Taiwan's security for trade concessions, the long-run architecture underpinning our neutrality gets harder to maintain.</p>

    <h3>⚖️ 2. GLOBAL POWER & POLICY — Spain's Sánchez Under Siege</h3>
    <p>Spanish Prime Minister Pedro Sánchez faced intensifying calls to resign after police searched Madrid headquarters of his Socialist Workers' Party.</p>
    <p>The investigation concerns allegations that party members secretly funded a campaign to smear judges. Opposition parties demanded early elections.</p>
    <p>For Singapore investors, EUR/SGD at 1.43 signals European political noise. 🇸🇬 Singapore institutional portfolios holding European defence equities face headwinds. The political turbulence adds to existing fragility in Southern European sovereign debt.</p>

    <h3>📊 3. MARKETS AND ECONOMICS — Markets closed for the weekend</h3>
    <p>Global equity and commodity markets are closed today. All figures below are Friday 30 May 2026 closing prices.</p>
    <p>S&P 500: record close (up ~5% for May). Nasdaq: record close (up ~8% for May). US 10-year Treasury yield: 4.7% (highest since mid-2007).</p>
    <p>For a Singapore reader, these two forces pull in opposite directions. 🇸🇬 Cheaper oil is good for our import-heavy economy. US yields at 4.7% sustain pressure on SGX REITs: when risk-free rates rise, the yield spread compresses.</p>

    <h3>💼 4. BUSINESS — Warner Music Group backs South Asian music</h3>
    <p>Warner Music Group partnered with 5 Junction to invest in South Asian artists targeting the US market.</p>
    <p>The South Asian diaspora in the US exceeds 5 million. Streaming data shows it as an under-monetised audience relative to its size.</p>
    <p>For Singapore, this matters because our music and creative industry sits at the crossroads of South Asian, Southeast Asian, and East Asian talent flows. 🇸🇬 We have infrastructure (LASALLE, Esplanade) but label investment has historically flowed elsewhere. If the model scales, expect Singapore to be in the conversation as a regional hub.</p>

    <h3>🤖 5. AI, TECHNOLOGY AND FUTURE OF WORK — AI lobbyists swarm US state legislatures</h3>
    <p>AI industry lobbyists have fanned out across US state legislatures in a coordinated campaign to shape state-level AI regulation.</p>
    <p>Emily Blunt refused to use AI to generate vocals for Spielberg's upcoming film, instead performing human-led workflow. The choice preserves craft integrity.</p>
    <p>For Singapore's workforce, this plays out in professional services where our workers are concentrated. 🇸🇬 Our SkillsFuture programme invests in retraining, but the US regulatory frameworks being written now will become the de facto global template. Our MOM and Smart Nation Group should track which state bills survive.</p>

    <h3>🔬 6. SCIENCE AND HEALTH — Josep Carreras Institute studies 117-year-old supercentenarian</h3>
    <p>Dr. Manel Esteller's team published the most comprehensive biological study on Maria Branyas Morera, who died at 117 years old.</p>
    <p>The findings show Branyas had short telomeres and pro-inflammatory immune system, yet displayed markers of healthy longevity. The implication: extreme aging and poor health are separable.</p>
    <p>For Singapore, both stories have institutional resonance. 🇸🇬 Our Agency for Integrated Care and Ministry of Health build aged-care architecture for a society ageing faster than almost any other in Asia. Dr. Esteller's findings give researchers a new target for longevity support.</p>

    <h3>🎭 7. CULTURE — Paper Tiger earns Cannes standing ovation</h3>
    <p>The film Paper Tiger received a standing ovation at Cannes Film Festival.</p>
    <p>The film explores themes of identity and belonging in contemporary Asia.</p>
    <p>For Singapore's creative industry, this validates the broader thesis that Asian cinema commands global attention. 🇸🇬 Singapore's film and media ecosystem benefits from regional talent flows and international recognition.</p>

    <h3>🔗 8. SYSTEMS SYNTHESIS — The Architecture of Trust is Being Rebuilt</h3>
    <p>Today's stories reveal a deeper pattern: great powers are recalibrating their relationships, and the institutions that governed the post-Cold War order are being quietly rewritten. Taiwan's demotion from security commitment to negotiating chip, Spain's political fragility, and the US regulatory race on AI all point to the same pressure: when trust erodes, actors write new rules faster than institutions can adapt.</p>
    <p>If the US-China détente deepens and Taiwan security becomes transactional, Singapore's hedging strategy becomes harder to maintain — our neutrality depends on great-power rules being stable, not auctioned. If AI regulation becomes a race between US states rather than a global framework, Singapore's tech sector must prepare for fragmented compliance. If European political instability spreads, SGX institutional portfolios holding European equities face repricing pressure.</p>
  `;

  it("should parse brief HTML correctly", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief).toBeDefined();
    expect(brief.date).toBeTruthy();
    expect(brief.greeting).toBeTruthy();
    expect(brief.teaser).toHaveLength(3);
    expect(brief.sections).toHaveLength(8);
  });

  it("should extract section headlines correctly", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief.sections[0].headline).toContain("Taiwan Omitted");
    expect(brief.sections[1].headline).toContain("Spain");
    expect(brief.sections[7].headline).toContain("Architecture of Trust");
  });

  it("should extract Singapore Lens from paragraph 3", () => {
    const brief = parseBriefHTML(sampleHTML);

    // Check that Singapore Lens is extracted for lead story
    expect(brief.sections[0].singaporeLens).toBeTruthy();
    expect(brief.sections[0].singaporeLens).toContain("SGX");
  });

  it("should extract sources correctly", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief.sections[0].sources.length).toBeGreaterThan(0);
    expect(brief.sections[0].sources[0].outlet).toBe("Reuters");
  });

  it("should estimate reading time", () => {
    const brief = parseBriefHTML(sampleHTML);

    for (const section of brief.sections) {
      expect(section.readingTime).toBeGreaterThan(0);
      expect(typeof section.readingTime).toBe("number");
    }
  });

  it("should extract teaser items", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief.teaser).toContain("Taiwan security downgraded to negotiating chip in US-China talks");
    expect(brief.teaser).toContain("3.5 million Americans lose food stamp benefits as Trump bill takes effect");
  });

  it("should validate brief structure", () => {
    const brief = parseBriefHTML(sampleHTML);
    const validation = validateBrief(brief);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it("should extract systems synthesis correctly", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief.systemsSynthesis).toBeDefined();
    expect(brief.systemsSynthesis.thesis).toBeTruthy();
    expect(brief.systemsSynthesis.signals.length).toBeGreaterThan(0);
  });

  it("should extract key metrics from markets section", () => {
    const brief = parseBriefHTML(sampleHTML);
    const marketsSection = brief.sections[2];

    // Markets section should have some metrics
    expect(marketsSection.keyMetrics).toBeDefined();
  });

  it("should assign correct categories to sections", () => {
    const brief = parseBriefHTML(sampleHTML);

    expect(brief.sections[0].category).toBe("geopolitics");
    expect(brief.sections[1].category).toBe("geopolitics");
    expect(brief.sections[2].category).toBe("economics");
    expect(brief.sections[3].category).toBe("business");
    expect(brief.sections[4].category).toBe("ai-tech");
    expect(brief.sections[5].category).toBe("science");
    expect(brief.sections[6].category).toBe("culture");
    expect(brief.sections[7].category).toBe("systems");
  });

  it("should determine urgency correctly", () => {
    const brief = parseBriefHTML(sampleHTML);

    // Lead story should be high urgency
    expect(brief.sections[0].urgency).toBe("high");
  });
});
