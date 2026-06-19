/**
 * May 31, 2026 Daily Ripple Brief
 * Parsed from Telegra.ph report
 */

import type { DailyBrief } from "./briefParser";

export const may31Brief: DailyBrief = {
  date: "May 31, 2026",
  greeting: "Good morning. Here is your daily intelligence brief, curated to connect the dots across global events.",
  teaser: [
    "Taiwan omitted at Shangri-La Dialogue",
    "3.5M Americans lose food benefits",
    "S&P 500 hits record; oil down 20%",
  ],
  sections: [
    {
      id: "1",
      category: "geopolitics",
      emoji: "🌐",
      headline: "Hegseth Omits Taiwan Entirely at Shangri-La Dialogue; Trump Dangles $14bn Arms Package as China 'Negotiating Chip'",
      summary:
        "US Defence Secretary Pete Hegseth addressed the Shangri-La Dialogue in Singapore without mentioning Taiwan — a striking departure from prior defence secretaries. Trump described a pending $14 billion arms package for Taiwan as 'a very good negotiating chip' with Beijing.",
      singaporeLens:
        "For Singapore, the Shangri-La Dialogue is a barometer we read carefully. Hegseth's omission will reverberate across Southeast Asian foreign ministries. If the US is trading Taiwan's security for trade concessions, the long-run architecture underpinning our neutrality gets harder to maintain.",
      paragraphs: [
        "In May 2025, Hegseth referred to Beijing repeatedly as 'Communist China' and warned that a Taiwan invasion 'would result in devastating consequences.' On Saturday, he described US-China relations as 'better than they've been in many years' and called for 'drama-free' ties in Asia.",
        "Hegseth did call on Asian allies to raise military spending to counter China's 'historic military buildup,' echoing the US push for partners to reach 3.5% of GDP on defence. Malaysia's Defence Minister Khaled Nordin told reporters the request was 'a good policy.'",
        "For the SGX, the immediate effect is nuanced: a softer US-China posture reduces tail risk for our banks (DBS, OCBC, UOB all have material Greater China exposure) and for CapitaLand Investments, which manages significant China-facing real estate assets.",
      ],
      keyMetrics: [
        { label: "US Arms Package for Taiwan", value: "$14B", change: "—", direction: "neutral" },
        { label: "Prior Taiwan Mentions (Hegseth)", value: "Multiple", change: "→ Zero", direction: "down" },
      ],
      tags: ["US-China Relations", "Taiwan", "Indo-Pacific", "Defence"],
      readingTime: 3,
      sources: [
        { outlet: "Politico", title: "Hegseth's Taiwan Omission", url: "https://www.politico.com/news/2026/05/31/hegseth-shangri-la-taiwan", date: "May 31, 2026" },
        { outlet: "AP News", title: "US Defence Strategy", url: "https://apnews.com/hub/us-china-relations/hegseth-asia-defense", date: "May 31, 2026" },
      ],
      urgency: "high",
    },
    {
      id: "2",
      category: "geopolitics",
      emoji: "⚖️",
      headline: "Trump's 'Big Beautiful Bill' Strips 3.5 Million Americans of Food Benefits; Hegseth's Defence-Spending Push Reshapes Asia's Strategic Calculus",
      summary:
        "More than 3.5 million Americans lost access to SNAP (food benefits) as Trump's bill took full effect. The Federal Reserve noted a 'remarkable increase in food insecurity.' Hegseth demands regional allies raise defence spending to 3.5% of GDP.",
      singaporeLens:
        "Singapore already spends around 3% of GDP on defence and is unlikely to face US pressure, but neighbours in ASEAN facing the 3.5% demand may redirect fiscal resources toward military procurement — much of which flows through our port and logistics companies, including ST Engineering.",
      paragraphs: [
        "The bill's fiscal architecture is simultaneously widening the deficit while cutting social support. The Congressional Budget Office's 'Budget and Economic Outlook: 2026 to 2036' already flagged a deteriorating path.",
        "The Committee for a Responsible Federal Budget warned that if yields stay near current levels — the 30-year Treasury hit 5.2%, a 19-year high — the US faces a compounding fiscal crisis with interest costs crowding out defence, Social Security, and Medicare.",
        "On the Asia side, Hegseth's demand at Shangri-La for regional allies to raise defence budgets to 3.5% of GDP is arriving precisely as Washington is cutting the domestic safety net to fund its own military expansion.",
      ],
      keyMetrics: [
        { label: "Americans Lost SNAP Benefits", value: "3.5M", change: "—", direction: "down" },
        { label: "US 30-Year Treasury Yield", value: "5.2%", change: "+0.3%", direction: "up" },
        { label: "Requested Defence Spending", value: "3.5% GDP", change: "—", direction: "neutral" },
      ],
      tags: ["US Fiscal Policy", "SNAP", "Defence Spending", "Asia Strategy"],
      readingTime: 3,
      sources: [
        { outlet: "CNBC", title: "SNAP Benefits Cut", url: "https://www.cnbc.com/2026/05/31/trump-bill-snap-benefits-3-5-million", date: "May 31, 2026" },
        { outlet: "Fortune", title: "Fiscal Crisis", url: "https://fortune.com/2026/05/31/us-fiscal-crisis-treasury-yields-defense", date: "May 31, 2026" },
      ],
      urgency: "high",
    },
    {
      id: "3",
      category: "economics",
      emoji: "📊",
      headline: "Markets Closed for Weekend; Friday Close: S&P 500 and Nasdaq at Records, US Yields at Multi-Year Highs, Oil Posts Biggest Monthly Drop Since 2020",
      summary:
        "Global equity and bond markets closed for the weekend. S&P 500 and Nasdaq hit record closes. US 10-year yield at 4.7% (highest since mid-2007). Brent crude down 20% for May — biggest monthly drop since 2020.",
      singaporeLens:
        "Cheaper oil is unambiguously good for our import-heavy economy and electricity tariffs. We import virtually all our energy, so a 20% fall in Brent feeds through to lower utility bills within two quarters. But US yields at 4.7% sustain pressure on SGX REITs.",
      paragraphs: [
        "Three forces drove the May rally: optimism about an end to the Iran-US war reducing oil-supply-risk premium, a run of positive corporate earnings reports, and continued strength in technology stocks.",
        "Iran-related peace signals caused Brent to shed roughly a fifth of its value in a single month, the sharpest monthly oil collapse since the COVID-19 demand crash of May 2020.",
        "That deflationary pulse is running directly into the bond market's inflationary alarm: the 10-year yield at 4.7% reflects not peace-driven demand optimism, but fiscal concern — investors are demanding more compensation to hold US government debt.",
      ],
      keyMetrics: [
        { label: "S&P 500", value: "Record High", change: "+5% (May)", direction: "up" },
        { label: "Nasdaq Composite", value: "Record High", change: "+8% (May)", direction: "up" },
        { label: "US 10-Year Yield", value: "4.7%", change: "Highest since 2007", direction: "up" },
        { label: "Brent Crude", value: "Down 20%", change: "Biggest drop since 2020", direction: "down" },
      ],
      tags: ["Markets", "Equities", "Bonds", "Oil", "Yields"],
      readingTime: 3,
      sources: [
        { outlet: "CNBC", title: "Market Close", url: "https://www.cnbc.com/2026/05/30/markets-sp500-nasdaq-record-oil-down", date: "May 30, 2026" },
        { outlet: "Fortune", title: "Market Analysis", url: "https://fortune.com/2026/05/30/sp500-nasdaq-brent-crude-yields", date: "May 30, 2026" },
      ],
      urgency: "medium",
    },
    {
      id: "4",
      category: "business",
      emoji: "💼",
      headline: "Warner Music Group and 5 Junction Back South Asian Music as New Global Revenue Frontier",
      summary:
        "Warner Music Group partnered with Anjula Acharia's label 5 Junction to invest in South Asian artists targeting the US market. The deal signals major labels are extending infrastructure to South Asian talent as a dedicated asset class.",
      singaporeLens:
        "For Singapore, this matters because our music and creative industry sits at the crossroads of South Asian, Southeast Asian, and East Asian talent flows. If the model scales, expect Singapore to be in the conversation as a regional hub for South Asian music production.",
      paragraphs: [
        "Acharia, who managed Priyanka Chopra Jonas's Hollywood crossover in the early 2000s, founded 5 Junction after Jimmy Iovine told her she was '20 years too early.' She now argues the window has opened.",
        "The South Asian diaspora in the US now exceeds 5 million, and streaming data increasingly shows it as an under-monetised audience relative to its size and disposable income.",
        "The K-pop playbook — systematic label investment, choreographed content, and diaspora-as-launchpad — is the explicit template for this expansion into South Asian talent.",
      ],
      keyMetrics: [
        { label: "South Asian Diaspora (US)", value: "5M+", change: "—", direction: "neutral" },
        { label: "Label Investment Focus", value: "South Asian", change: "New", direction: "up" },
      ],
      tags: ["Music Industry", "South Asian", "Warner Music", "Streaming"],
      readingTime: 2,
      sources: [
        { outlet: "CNBC", title: "Warner Music Partnership", url: "https://www.cnbc.com/2026/05/31/warner-music-5-junction-south-asian-artists", date: "May 31, 2026" },
        { outlet: "Variety", title: "South Asian Music", url: "https://variety.com/2026/music/news/warner-music-south-asian-talent", date: "May 31, 2026" },
      ],
      urgency: "medium",
    },
    {
      id: "5",
      category: "ai-tech",
      emoji: "🤖",
      headline: "AI Lobbyists Swarm US State Legislatures; Emily Blunt's Spielberg Choice Spotlights Human-versus-AI Tension on Creative Sets",
      summary:
        "AI industry lobbyists have fanned out across US state legislatures to shape AI regulation before restrictive state laws calcify. Emily Blunt refused AI-generated vocals for Spielberg's film, choosing human performance instead.",
      singaporeLens:
        "For Singapore's workforce, this plays out most acutely in professional services where our workers are concentrated: law, finance, accounting, design, and media. Our SkillsFuture programme has been investing in retraining, but the US regulatory frameworks being written now will flow into Singapore's own tech sector.",
      paragraphs: [
        "The effort is explicitly aimed at establishing industry-friendly frameworks before a patchwork of restrictive state laws can calcify, echoing the early-internet lobbying battles of the 1990s.",
        "Blunt told interviewer Sean Evans that she actively refused to use AI to generate a non-human vocal sequence, instead performing clicking, humming, and breathing sounds that were then processed by the film's sound designer.",
        "The choice is notable precisely because Spielberg had the budget and technology to go AI-generated, but a named lead actor's preference determined the outcome.",
      ],
      keyMetrics: [
        { label: "AI Lobbying States", value: "Multiple", change: "Expanding", direction: "up" },
        { label: "Creative Labour Impact", value: "High", change: "—", direction: "neutral" },
      ],
      tags: ["AI Regulation", "Lobbying", "Creative Labour", "Technology"],
      readingTime: 3,
      sources: [
        { outlet: "NBC News", title: "AI Lobbying", url: "https://www.nbcnews.com/tech/ai-lobbyists-state-legislatures-2026", date: "May 31, 2026" },
        { outlet: "Variety", title: "Emily Blunt AI", url: "https://variety.com/2026/film/news/emily-blunt-spielberg-ai-vocals", date: "May 31, 2026" },
      ],
      urgency: "high",
    },
    {
      id: "6",
      category: "science",
      emoji: "🔬",
      headline: "Josep Carreras Institute Study of 117-Year-Old Supercentenarian Rewrites Assumptions About Extreme Aging; WHO Responds to Ebola Outbreak",
      summary:
        "A team led by Dr. Josep Carreras Institute published findings from a 117-year-old supercentenarian that challenge conventional aging models. WHO coordinates response to emerging Ebola outbreak.",
      singaporeLens:
        "Singapore's ageing population and healthcare infrastructure make longevity research directly relevant. Our Ministry of Health and research institutions should track these breakthroughs as they inform policy on elderly care and healthcare resource allocation.",
      paragraphs: [
        "The study reveals that extreme longevity may be governed by different biological mechanisms than normal aging, with implications for pharmaceutical intervention strategies.",
        "The WHO's response to the Ebola outbreak underscores the ongoing pandemic preparedness challenges that Singapore's health system continues to monitor.",
      ],
      keyMetrics: [
        { label: "Study Subject Age", value: "117 years", change: "—", direction: "neutral" },
        { label: "Aging Model Revision", value: "Significant", change: "New", direction: "up" },
      ],
      tags: ["Longevity", "Ageing", "Healthcare", "Research"],
      readingTime: 2,
      sources: [
        { outlet: "Josep Carreras Institute", title: "Longevity Study", url: "https://www.carrerasresearch.org/research/supercentenarian-aging-study", date: "May 31, 2026" },
        { outlet: "WHO", title: "Ebola Response", url: "https://www.who.int/emergencies/disease-outbreak-news/item/ebola-2026", date: "May 31, 2026" },
      ],
      urgency: "medium",
    },
    {
      id: "7",
      category: "culture",
      emoji: "🎬",
      headline: "'Paper Tiger' Earns Cannes Ovation; Singapore's Soft Power Moment in Global Cinema",
      summary:
        "A film exploring identity and diaspora earned a standing ovation at Cannes. The film's success highlights Singapore's emerging role in regional creative production.",
      singaporeLens:
        "Singapore's Cannes success signals our growing influence in global cinema. Our Media Development Authority's investments in local talent and infrastructure are yielding international recognition.",
      paragraphs: [
        "The film's narrative resonates with audiences across cultures, demonstrating the universal appeal of stories rooted in specific cultural contexts.",
        "Singapore's role as a production hub and creative incubator continues to strengthen, attracting international talent and investment.",
      ],
      keyMetrics: [
        { label: "Cannes Standing Ovation", value: "Yes", change: "—", direction: "up" },
        { label: "Singapore Film Presence", value: "Growing", change: "—", direction: "up" },
      ],
      tags: ["Cinema", "Cannes", "Culture", "Singapore"],
      readingTime: 2,
      sources: [
        { outlet: "Variety", title: "Cannes Film Festival", url: "https://variety.com/2026/film/reviews/paper-tiger-cannes-standing-ovation", date: "May 31, 2026" },
        { outlet: "Hollywood Reporter", title: "Paper Tiger", url: "https://www.hollywoodreporter.com/movies/movie-reviews/paper-tiger-cannes-2026", date: "May 31, 2026" },
      ],
      urgency: "low",
    },
    {
      id: "8",
      category: "systems",
      emoji: "🏛️",
      headline: "The Architecture of Trust Is Being Rebuilt",
      summary:
        "Across geopolitics, markets, and technology, the foundational systems that enable global commerce and security are being reconstructed. Singapore sits at the nexus of these changes.",
      singaporeLens:
        "Singapore's position as a trusted intermediary — in finance, logistics, and diplomacy — becomes more valuable as global trust architectures fragment and reconfigure. Our neutrality, rule-of-law framework, and strategic location position us uniquely to benefit from this realignment.",
      paragraphs: [
        "The Shangri-La Dialogue, the bond markets' repricing of US fiscal risk, the AI regulatory battles, and the music industry's expansion all reflect a world where old certainties are dissolving.",
        "In this environment, Singapore's role as a trusted hub — where multiple powers can transact, where rule of law is predictable, where information flows freely — becomes a strategic asset.",
        "The question for policymakers is whether we can maintain that trust while the world around us reorganises. The answer lies in staying ahead of these shifts, not reacting to them.",
      ],
      keyMetrics: [
        { label: "Global Trust Index", value: "Declining", change: "—", direction: "down" },
        { label: "Singapore's Position", value: "Strengthening", change: "—", direction: "up" },
      ],
      tags: ["Systems Thinking", "Geopolitics", "Finance", "Technology"],
      readingTime: 3,
      sources: [
        { outlet: "The Daily Ripple", title: "Systems Synthesis", url: "https://ripple.sg", date: "May 31, 2026" },
      ],
      urgency: "high",
    },
  ],
  systemsSynthesis: {
    thesis: "The Architecture of Trust Is Being Rebuilt",
    signals: [
      "US strategic ambiguity on Taiwan signals a shift from rules-based to transactional geopolitics",
      "Fiscal pressures in Washington are reshaping defence commitments and social safety nets simultaneously",
      "AI regulation is being written by industry, not government — a critical moment for labour and creativity",
      "Oil prices and bond yields are pulling in opposite directions, creating portfolio complexity for investors",
      "Singapore's role as a trusted intermediary becomes more valuable as global trust architectures fragment",
      "Taiwan omission + arms package as 'chip' → US-China relations are transactional, not rules-based",
      "SNAP cuts + defence spending demands → Washington is prioritising military expansion over social support",
      "AI lobbying + Emily Blunt's choice → The future of creative labour is being decided now",
      "Oil down 20% + yields at 4.7% → Deflationary pulse meets fiscal alarm in bond markets",
      "All of the above → Singapore's neutrality and rule-of-law framework are becoming strategic assets",
    ],
  },
};
