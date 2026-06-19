# Daily Ripple - Sample Briefs Export

This directory contains all 6 sample briefs from the Ripple Dashboard, exported for use with Claude Code.

## Files

- **SAMPLE_BRIEF_SCHEMA.json** - A complete brief in JSON format showing the exact data structure. Use this as a reference for understanding the schema.
- **may31Brief.ts** - May 31, 2026 brief (TypeScript format)
- **june1Brief.ts** - June 1, 2026 brief (TypeScript format)
- **june2Brief.ts** - June 2, 2026 brief (TypeScript format)
- **june3Brief.ts** - June 3, 2026 brief (TypeScript format)
- **jun4Brief.ts** - June 4, 2026 brief (TypeScript format)
- **jun5Brief.ts** - June 5, 2026 brief (TypeScript format)

## Brief Data Structure

Each brief contains:

```
{
  "date": "June 1, 2026",
  "greeting": "Opening message",
  "teaser": ["headline1", "headline2", "headline3"],
  "sections": [
    {
      "id": "1",
      "category": "geopolitics|business|economics|ai-tech|science|culture|systems",
      "emoji": "🌍",
      "headline": "Story headline",
      "summary": "Brief summary (1-2 sentences)",
      "singaporeLens": "How this affects Singapore",
      "paragraphs": ["para1", "para2", "para3"],
      "keyMetrics": [
        {
          "label": "Metric name",
          "value": "123",
          "change": "+5%",
          "direction": "up|down|neutral"
        }
      ],
      "tags": ["tag1", "tag2"],
      "readingTime": 3,
      "sources": [
        {
          "outlet": "Reuters",
          "title": "Article title",
          "url": "https://...",
          "date": "June 1, 2026"
        }
      ],
      "urgency": "high|medium|low"
    }
  ]
}
```

## How to Use with Claude

1. Share **SAMPLE_BRIEF_SCHEMA.json** with Claude to show the exact data structure
2. Share the 6 TypeScript brief files so Claude can see real examples
3. Explain that you want Claude to recreate the Trends logic from scratch based on this data structure
4. Claude can then propose how to:
   - Extract signal threads across briefs
   - Map stories to signals by date
   - Synthesize Singapore Lens evolution
   - Compare signals across the week

## Key Fields Explained

- **date**: The date of the brief (YYYY-MM-DD format preferred)
- **greeting**: Opening message to the reader
- **teaser**: 3 headline teasers for the brief
- **sections**: Array of stories, each with:
  - **category**: Topic classification
  - **headline**: Main story title
  - **summary**: 1-2 sentence summary
  - **singaporeLens**: How this story affects Singapore specifically
  - **paragraphs**: 2-3 detailed paragraphs
  - **keyMetrics**: 2-4 key metrics with values and direction
  - **sources**: 1-3 source links with outlet, title, URL, date
  - **urgency**: Priority level (high/medium/low)
  - **tags**: Relevant topic tags

## Next Steps for Claude

With this data, Claude should be able to:

1. **Understand the data model** - See how briefs are structured
2. **Identify signals** - Extract recurring themes/signals across briefs
3. **Map signal evolution** - Track how each signal changes across dates
4. **Synthesize narratives** - Create Singapore Lens evolution story
5. **Design Trends view** - Propose how to display signal analysis

## Questions for Claude

- How should signals be identified and grouped?
- What constitutes a "signal thread" across multiple briefs?
- How should we measure signal strength/importance?
- How should we visualize signal evolution over time?
- How should we synthesize the Singapore Lens narrative?

---

**Created**: June 12, 2026  
**Format**: TypeScript (original) + JSON (schema reference)  
**Status**: Ready for Claude Code analysis
