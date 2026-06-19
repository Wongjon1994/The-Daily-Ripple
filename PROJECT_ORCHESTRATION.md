# Daily Ripple Project Orchestration Document

**Status**: Ready for Claude Implementation  
**Current Workflow**: DailyRippleMVP1.8forClaude  
**Target**: Add signal extraction with UI display  
**Timeline**: 9:30 AM SGT daily, with manual testing capability

---

## Executive Summary

The Daily Ripple is a two-stage LLM-powered briefing system:

1. **Stage 1 (Generation)**: Claude writes an 8-section daily brief from search results → Published to Telegraph
2. **Stage 2 (Extraction)**: Claude reads Telegraph HTML → Extracts structured data + signals → Dashboard displays

**New Feature**: Extract semantic signals (market data, trend indicators, key metrics) from Telegraph articles and display as interactive badges/chips in the website UI.

---

## Current System Architecture

### Stage 1: Generation (21:30 SGT)

**Workflow**: `DailyRippleMVP1.8forClaude`

```
Schedule Trigger (21:30)
    ↓
Set Date + Read Memory
    ↓
Tools Agent (Claude + Tavily Search)
├─ 6 Tavily searches (markets, Singapore, politics, business, tech, culture)
├─ Claude writes 8-section brief (HTML)
├─ Outputs: title, teaser, sections, date
└─ Max iterations: 18
    ↓
Code: Format for Telegra.ph
├─ Parses Claude's HTML output
├─ Extracts teaser bullets
├─ Extracts URL registry
├─ Formats for Telegraph API
└─ Outputs: telegraphContent, dateStr, teaser
    ↓
Publish to Telegraph
├─ POST to api.telegra.ph/createPage
├─ Creates: https://telegra.ph/The-Daily-Ripple-[DATE]
└─ Returns: Telegraph URL
    ↓
Telegram: Send Brief
└─ Notifies subscribers with Telegraph link
```

**Output**: Human-readable Telegraph article

---

### Stage 2: Extraction (Manual Test or Auto-Trigger)

**New Workflow**: To be created

```
Manual Trigger OR Auto-Trigger (after Stage 1)
    ↓
Fetch Telegraph Article
├─ GET https://telegra.ph/The-Daily-Ripple-[DATE]
├─ Response Format: Text
└─ Output Field: data
    ↓
Parse Telegraph to Sections
├─ Extract 8 sections (title, content, category)
├─ Extract teaser bullets
├─ Extract signals (NEW)
├─ Extract Singapore lens
└─ Outputs: sections array with signals
    ↓
Validate Brief Schema
├─ Check required fields
├─ Validate signal structure (NEW)
├─ Sanitize content
└─ Outputs: valid flag + sanitized brief
    ↓
If Node (Conditional)
├─ TRUE: Continue to dashboard API
└─ FALSE: Send error to Telegram
    ↓
POST Brief to Dashboard
├─ POST to /api/scheduled/publish-n8n-brief
├─ Payload includes signals (NEW)
└─ Outputs: briefId, dashboardUrl
    ↓
Dashboard API (Server-side Validation)
├─ Validate schema again
├─ Persist to n8nBriefs table (with signals)
└─ Return: ok flag
    ↓
Frontend tRPC Query
├─ trpc.n8n.getLatest.useQuery()
├─ Fetches brief + signals
└─ Returns: typed brief object
    ↓
Website Display
├─ Render sections with content
├─ Render signals as badges/chips (NEW)
└─ Enable swipe navigation
```

**Output**: Structured data in dashboard database + website display

---

## Feature: Signal Extraction

### What are Signals?

Signals are **semantic data points** extracted from Telegraph articles that represent key metrics, trends, or indicators.

**Examples**:
```
US Arms Package for Taiwan: $14B ↓
Prior Taiwan Mentions (Hegseth): Multiple ↓→Zero
Nikkei 225: 33,500 ↑ (all-time high)
SGD/JPY: 105.2 ↓ (yen weakness)
Brent Oil: $82/bbl ↑ (Hormuz tensions)
```

**Structure**:
```json
{
  "label": "US Arms Package for Taiwan",
  "value": "$14B",
  "trend": "down",
  "category": "geopolitics",
  "section": 2
}
```

### Telegraph HTML Structure for Signals

Claude must wrap signals in a specific HTML structure when publishing to Telegraph.

**Format**:
```html
<h3>🌐 1. LEAD STORY — Singapore steps into Hormuz energy diplomacy</h3>

<p><b>Singapore's Ministry of Foreign Affairs (MFA)</b> is actively working...</p>

<p>For us, this is Port of Singapore business...</p>

<!-- SIGNALS BLOCK - REQUIRED FORMAT -->
<div class="signals">
  <div class="signal">
    <span class="label">US Arms Package for Taiwan</span>
    <span class="value">$14B</span>
    <span class="trend">down</span>
  </div>
  <div class="signal">
    <span class="label">Prior Taiwan Mentions (Hegseth)</span>
    <span class="value">Multiple</span>
    <span class="trend">down_to_zero</span>
  </div>
</div>
<!-- END SIGNALS BLOCK -->
```

**Signal Trend Values**:
- `up` - Value increased
- `down` - Value decreased
- `stable` - Value unchanged
- `up_to_down` - Changed from up to down
- `down_to_up` - Changed from down to up
- `up_to_zero` - Changed from up to zero/none
- `down_to_zero` - Changed from down to zero/none
- `new` - New signal (first mention)

### Signal Placement Rules

1. **One signals block per section** (optional)
2. **Placed after main content** (before next h3 header)
3. **Maximum 3 signals per section**
4. **Each signal must have**: label, value, trend
5. **Labels must be specific** (no generic labels like "Update" or "Change")

---

## Implementation Roadmap

### Phase 1: Update Telegraph Structure (Claude's Job)

**What Claude needs to do**:
1. Update system prompt in Tools Agent to include signal extraction rules
2. When writing Telegraph HTML, include `<div class="signals">` blocks
3. Ensure signals are semantically meaningful (not filler)
4. Test with today's Telegraph article

**System Prompt Addition**:
```
SIGNALS EXTRACTION:
When writing each section, identify 1-3 key data points or trends that represent 
the core metrics/indicators of that story. Wrap them in:

<div class="signals">
  <div class="signal">
    <span class="label">[Specific metric or indicator]</span>
    <span class="value">[Current value or status]</span>
    <span class="trend">[up|down|stable|up_to_down|down_to_up|up_to_zero|down_to_zero|new]</span>
  </div>
</div>

Examples:
- Section 1 (Hormuz): "Brent Oil: $82/bbl" with trend "up"
- Section 2 (Hegseth): "ASEAN Defense Spending: 3.5% of GDP target" with trend "new"
- Section 3 (Markets): "Nikkei 225: 33,500" with trend "up"

Rules:
- Labels must be specific and measurable
- Values must be concrete (numbers, percentages, or clear statuses)
- Trends must accurately reflect the narrative
- Maximum 3 signals per section
- Signals should support the section's main narrative
```

### Phase 2: Update Database Schema

**File**: `drizzle/schema.ts`

**Add to n8nBriefs table**:
```typescript
export const n8nBriefs = sqliteTable('n8nBriefs', {
  // ... existing fields ...
  
  // New: signals column (JSON array)
  signals: text('signals', { mode: 'json' }).$type<Signal[]>(),
});

// New type definition
export type Signal = {
  label: string;        // e.g., "US Arms Package for Taiwan"
  value: string;        // e.g., "$14B"
  trend: TrendType;     // e.g., "down"
  category?: string;    // e.g., "geopolitics" (optional)
  section?: number;     // e.g., 1 (optional, for filtering)
};

export type TrendType = 
  | 'up' 
  | 'down' 
  | 'stable' 
  | 'up_to_down' 
  | 'down_to_up' 
  | 'up_to_zero' 
  | 'down_to_zero' 
  | 'new';
```

**Migration**:
```bash
cd /home/ubuntu/ripple-dashboard
pnpm db:push
```

### Phase 3: Update Extraction Logic (n8n)

**File**: Parse Telegraph to Sections (Code Node)

**Add signal parsing**:
```javascript
// Extract signals from each section
function extractSignals(sectionHtml) {
  const signals = [];
  const signalRegex = /<div class="signal">([\s\S]*?)<\/div>/gi;
  let signalMatch;
  
  while ((signalMatch = signalRegex.exec(sectionHtml)) !== null) {
    const signalContent = signalMatch[1];
    
    const labelMatch = signalContent.match(/<span class="label">([^<]+)<\/span>/);
    const valueMatch = signalContent.match(/<span class="value">([^<]+)<\/span>/);
    const trendMatch = signalContent.match(/<span class="trend">([^<]+)<\/span>/);
    
    if (labelMatch && valueMatch && trendMatch) {
      signals.push({
        label: labelMatch[1].trim(),
        value: valueMatch[1].trim(),
        trend: trendMatch[1].trim()
      });
    }
  }
  
  return signals;
}

// Update section extraction to include signals
const sections = [];
const sectionRegex = /<h3[^>]*>([^<]+)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
let sectionMatch;

while ((sectionMatch = sectionRegex.exec(html)) !== null) {
  const sectionTitle = stripTags(sectionMatch[1]);
  const sectionContent = sectionMatch[2];
  
  // Extract paragraphs (as before)
  const paragraphs = [];
  // ... existing paragraph extraction code ...
  
  // NEW: Extract signals
  const signals = extractSignals(sectionContent);
  
  // Remove signals from content before storing
  const contentWithoutSignals = sectionContent
    .replace(/<div class="signals">[\s\S]*?<\/div>/gi, '')
    .trim();
  
  if (paragraphs.length > 0) {
    sections.push({
      title: sectionTitle,
      summary: paragraphs[0].substring(0, 300),
      content: paragraphs.join('\n\n'),
      category: extractCategory(sectionTitle),
      singaporeLens: paragraphs[paragraphs.length - 1].substring(0, 200),
      signals: signals  // NEW
    });
  }
}
```

### Phase 4: Update Validation Schema

**File**: Validate Brief Schema (Code Node)

**Add signal validation**:
```javascript
// Validate signals
if (brief.sections) {
  brief.sections.forEach((section, idx) => {
    if (section.signals && Array.isArray(section.signals)) {
      section.signals.forEach((signal, sigIdx) => {
        if (!signal.label) errors.push(`Section ${idx}, Signal ${sigIdx}: Missing label`);
        if (!signal.value) errors.push(`Section ${idx}, Signal ${sigIdx}: Missing value`);
        if (!signal.trend) errors.push(`Section ${idx}, Signal ${sigIdx}: Missing trend`);
        
        // Validate trend value
        const validTrends = ['up', 'down', 'stable', 'up_to_down', 'down_to_up', 'up_to_zero', 'down_to_zero', 'new'];
        if (!validTrends.includes(signal.trend)) {
          errors.push(`Section ${idx}, Signal ${sigIdx}: Invalid trend "${signal.trend}"`);
        }
        
        // Length checks
        if (signal.label.length > 100) errors.push(`Section ${idx}, Signal ${sigIdx}: Label too long`);
        if (signal.value.length > 50) errors.push(`Section ${idx}, Signal ${sigIdx}: Value too long`);
      });
    }
  });
}
```

### Phase 5: Create Signal UI Component

**File**: `client/src/components/SignalBadge.tsx`

```typescript
import React from 'react';

export type Signal = {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable' | 'up_to_down' | 'down_to_up' | 'up_to_zero' | 'down_to_zero' | 'new';
};

export const SignalBadge: React.FC<{ signal: Signal }> = ({ signal }) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      case 'stable':
        return '→';
      case 'up_to_down':
        return '↑→↓';
      case 'down_to_up':
        return '↓→↑';
      case 'up_to_zero':
        return '↑→0';
      case 'down_to_zero':
        return '↓→0';
      case 'new':
        return '✦';
      default:
        return '—';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
      case 'down_to_up':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'down':
      case 'up_to_down':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'stable':
      case 'up_to_zero':
      case 'down_to_zero':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getTrendColor(signal.trend)} text-sm font-medium`}>
      <span className="font-semibold">{signal.label}</span>
      <span className="font-bold">{signal.value}</span>
      <span className="text-lg leading-none">{getTrendIcon(signal.trend)}</span>
    </div>
  );
};

export const SignalGrid: React.FC<{ signals: Signal[] }> = ({ signals }) => {
  if (!signals || signals.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {signals.map((signal, idx) => (
        <SignalBadge key={idx} signal={signal} />
      ))}
    </div>
  );
};
```

### Phase 6: Integrate Signals into BriefPageEnhanced

**File**: `client/src/pages/BriefPageEnhanced.tsx`

**Update section rendering**:
```typescript
import { SignalGrid } from '@/components/SignalBadge';

// Inside the section rendering loop:
{brief.sections.map((section, idx) => (
  <div key={idx} className="space-y-3">
    <h3 className="text-lg font-bold text-foreground">{section.title}</h3>
    
    <p className="text-sm text-muted-foreground">{section.summary}</p>
    
    {/* NEW: Render signals */}
    {section.signals && section.signals.length > 0 && (
      <SignalGrid signals={section.signals} />
    )}
    
    {/* Expand/collapse content */}
    {isExpanded && (
      <p className="text-sm text-foreground whitespace-pre-wrap">{section.content}</p>
    )}
  </div>
))}
```

### Phase 7: Update tRPC Router

**File**: `server/routers.ts`

**Update return type**:
```typescript
export const appRouter = router({
  n8n: router({
    getLatest: publicProcedure
      .query(async ({ ctx }) => {
        const latest = await getLatestN8nBrief();
        return {
          ...latest,
          sections: latest.sections.map(s => ({
            ...s,
            signals: s.signals || [] // Ensure signals are included
          }))
        };
      }),
    // ... other procedures
  }),
});
```

### Phase 8: Testing Checklist

**Manual Testing (Today)**:
- [ ] Create manual trigger workflow in n8n
- [ ] Fetch today's Telegraph article
- [ ] Verify signals are extracted correctly
- [ ] Check n8n validation passes
- [ ] Verify POST to dashboard succeeds
- [ ] Check database has signals stored
- [ ] Verify website displays signal badges
- [ ] Test signal styling (colors, icons, trends)

**Production Testing (9:30 AM)**:
- [ ] Stage 1 generates brief with signals in Telegraph HTML
- [ ] Stage 2 auto-triggers and extracts signals
- [ ] Website displays signals alongside content
- [ ] Signals update daily as expected

---

## File Changes Summary

| File | Change | Type |
|------|--------|------|
| `drizzle/schema.ts` | Add signals column to n8nBriefs | Database |
| `server/routers.ts` | Update return type to include signals | Backend |
| `client/src/components/SignalBadge.tsx` | Create new component | Frontend |
| `client/src/pages/BriefPageEnhanced.tsx` | Integrate SignalGrid | Frontend |
| n8n: Parse Telegraph to Sections | Add signal extraction logic | n8n |
| n8n: Validate Brief Schema | Add signal validation | n8n |
| n8n: Tools Agent | Update system prompt | n8n |

---

## Deployment Order

1. **Database**: Run migration (`pnpm db:push`)
2. **Backend**: Update router type
3. **Frontend**: Add SignalBadge component + integrate into BriefPageEnhanced
4. **n8n Stage 1**: Update Tools Agent system prompt
5. **n8n Stage 2**: Add extraction + validation logic
6. **Testing**: Manual test with today's article
7. **Production**: Deploy and monitor 9:30 AM run

---

## Success Criteria

- ✅ Telegraph articles include signal blocks with correct HTML structure
- ✅ n8n extracts signals from Telegraph HTML
- ✅ Signals pass validation (required fields, valid trends)
- ✅ Dashboard API persists signals to database
- ✅ Website displays signals as colored badges with trend icons
- ✅ Signals appear alongside section content
- ✅ Daily 9:30 AM run generates signals automatically
- ✅ Manual testing works with existing Telegraph articles

---

## Rollback Plan

If signals cause issues:

1. **Immediate**: Disable signal display in frontend (comment out SignalGrid)
2. **Short-term**: Remove signals from n8n extraction (keep Telegraph structure)
3. **Long-term**: Revert database migration if needed

Signals are **additive** — the system works without them, so they can be safely disabled.

---

## Next Steps

1. **Approve this plan** with any modifications
2. **Hand off to Claude** with this document
3. **Claude implements** in order: Database → Backend → Frontend → n8n
4. **Test today** with manual Telegraph article
5. **Deploy** for 9:30 AM production run

---

## Questions for Claude

When implementing, Claude should clarify:

1. **Signal frequency**: Should every section have signals, or only when relevant?
2. **Signal priority**: Should signals appear before or after section content?
3. **Trend accuracy**: How should Claude determine trends (from search results, prior briefs, or inference)?
4. **Signal categories**: Should signals be categorized (markets, geopolitics, tech, etc.)?
5. **Mobile display**: How should signals render on mobile (stacked vs. wrapped)?

---

## Appendix: Example Telegraph Structure

```html
<!DOCTYPE html>
<html>
<head>
  <title>The Daily Ripple</title>
</head>
<body>
  <h1>The Daily Ripple</h1>
  <p>June 01, 2026</p>

  <div id="teaser">
    <li>Singapore steps into Hormuz energy diplomacy</li>
    <li>Hegseth's Shangri-La exit: 'pay your own way'</li>
    <li>Nikkei hits all-time highs on AI wave</li>
  </div>

  <h3>🌐 1. LEAD STORY — Singapore steps into Hormuz energy diplomacy; CapitaLand's China retreat hits 365 jobs</h3>
  
  <p><b>Singapore's Ministry of Foreign Affairs (MFA)</b> is actively working to keep Asian oil flows intact as the Strait of Hormuz remains without a durable reopening agreement, according to the Financial Times on Monday.</p>
  
  <p>For us, this is Port of Singapore business in the most direct sense: our bunkering and transshipment volumes are tied to Middle East crude flows, and any permanent rerouting away from Hormuz would redraw Asian energy logistics in ways that could benefit or bypass our port depending on which alternative corridors gain primacy.</p>

  <!-- SIGNALS BLOCK -->
  <div class="signals">
    <div class="signal">
      <span class="label">Hormuz Ceasefire Duration</span>
      <span class="value">60 days</span>
      <span class="trend">new</span>
    </div>
    <div class="signal">
      <span class="label">Brent Oil Price</span>
      <span class="value">$82/bbl</span>
      <span class="trend">up</span>
    </div>
    <div class="signal">
      <span class="label">Singapore Port Risk</span>
      <span class="value">Elevated</span>
      <span class="trend">up</span>
    </div>
  </div>
  <!-- END SIGNALS BLOCK -->

  <hr>

  <h3>⚖️ 2. GLOBAL POWER & POLICY — Hegseth's Shangri-La exit note: "pay your own way"; New Jersey ICE protests force White House pivot</h3>
  
  <!-- ... more content ... -->

</body>
</html>
```

---

**Document Version**: 1.0  
**Last Updated**: June 1, 2026  
**Ready for**: Claude Implementation
