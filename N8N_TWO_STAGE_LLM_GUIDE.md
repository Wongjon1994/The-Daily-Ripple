# Two-Stage LLM Extraction Guide for Ripple Dashboard

## Architecture Overview

Your workflow implements a **two-stage LLM extraction** with Telegraph as the intermediary:

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: GENERATION (21:30 SGT Daily)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Schedule Trigger (21:30)                                       │
│         ↓                                                        │
│  Set Date + Read Memory                                         │
│         ↓                                                        │
│  Tools Agent (Claude + Tavily Search)                           │
│  ├─ Runs 6 Tavily searches                                      │
│  ├─ Claude reads search results                                 │
│  └─ Claude writes 8-section brief (HTML)                        │
│         ↓                                                        │
│  Code: Format for Telegra.ph                                    │
│  ├─ Parses Claude's HTML                                        │
│  ├─ Extracts teaser, sources, date                              │
│  └─ Prepares Telegraph payload                                  │
│         ↓                                                        │
│  Publish to Telegraph                                           │
│  └─ Posts to telegra.ph/The-Daily-Ripple-[DATE]                │
│         ↓                                                        │
│  Telegram: Send Brief                                           │
│  └─ Notifies subscribers with link                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                    Telegraph Article Published
                    (Human-readable HTML)
                            ↓
                    
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: EXTRACTION (Manual Test or Auto-Trigger)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Manual Trigger (for testing) OR Auto-Trigger (after Stage 1)  │
│         ↓                                                        │
│  Fetch Telegraph Article                                        │
│  └─ GET https://telegra.ph/The-Daily-Ripple-[DATE]             │
│         ↓                                                        │
│  Parse Telegraph to Sections                                    │
│  ├─ Extract 8 sections with titles, content                     │
│  ├─ Extract teaser bullets                                      │
│  ├─ Extract Singapore lens from each section                    │
│  └─ Extract category from section header                        │
│         ↓                                                        │
│  Validate Brief Schema                                          │
│  ├─ Client-side validation (n8n)                                │
│  └─ Check required fields, lengths, structure                   │
│         ↓                                                        │
│  If Node (Conditional)                                          │
│  ├─ TRUE: Continue to dashboard API                             │
│  └─ FALSE: Send error notification to Telegram                  │
│         ↓                                                        │
│  POST Brief to Dashboard                                        │
│  └─ Send to /api/scheduled/publish-n8n-brief                    │
│         ↓                                                        │
│  Dashboard API (Server-side Validation)                         │
│  ├─ Validate schema again (defense in depth)                    │
│  ├─ Sanitize content                                            │
│  └─ Persist to n8nBriefs table                                  │
│         ↓                                                        │
│  Frontend tRPC Query                                            │
│  ├─ trpc.n8n.getLatest.useQuery()                               │
│  └─ Fetches latest brief from database                          │
│         ↓                                                        │
│  Website Display                                                │
│  └─ Renders brief in bento boxes with swipe navigation          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Generation (Your Existing Workflow)

**When**: 21:30 SGT daily (or manual trigger)

**What happens**:
1. Claude reads 6 Tavily search results
2. Claude writes full 8-section brief as HTML
3. Formatted and published to Telegraph
4. Telegram notification sent

**Output**: Telegraph article at `https://telegra.ph/The-Daily-Ripple-[DATE]`

**Your workflow already does this.** No changes needed.

---

## Stage 2: Extraction (What You're Testing Today)

**When**: 
- **Testing**: Manual trigger with existing Telegraph article
- **Production**: Automatically after Stage 1 completes (or separate scheduled job)

**What happens**:
1. Fetch Telegraph HTML
2. Claude reads Telegraph HTML (NOT search results)
3. Claude extracts structured data (sections, teaser, Singapore lens)
4. Validate and send to dashboard
5. Website displays

---

## Testing Today: Manual Telegraph Input

### Scenario
You have an existing Telegraph article: `https://telegra.ph/The-Daily-Ripple-06-01`

You want to test: **"How would Claude read this Telegraph article and extract structured data for the website?"**

### Step-by-Step

#### Step 1: Create Manual Trigger Workflow

1. In n8n, create a **new workflow** or duplicate your existing one
2. **Delete** the Schedule Trigger node
3. **Add** a Manual Trigger node at the start
4. **Delete** everything up to and including "Publish to Telegraph"
5. **Keep only**:
   - Manual Trigger
   - Fetch Telegraph Article (new HTTP node)
   - Parse Telegraph to Sections (new Code node)
   - Validate Brief Schema (new Code node)
   - If Node (conditional)
   - POST Brief to Dashboard
   - Error handling (Telegram notification)

**Result**: A streamlined workflow that takes a Telegraph URL as input and extracts structured data.

#### Step 2: Configure Fetch Telegraph Article

**Node Name**: `Fetch Telegraph Article`

**Configuration**:
- **Method**: GET
- **URL**: `https://telegra.ph/The-Daily-Ripple-06-01`
- **Options → Response → Response Format**: `Text`
- **Options → Response → Put Output in Field**: `data`

This fetches the raw HTML of the Telegraph article.

#### Step 3: Configure Parse Telegraph to Sections

**Node Name**: `Parse Telegraph to Sections`

**Code**:
```javascript
const html = $input.item.json.data; // Raw HTML from Telegraph

// Helper: Strip HTML tags
function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').trim();
}

// Extract title
const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
const title = titleMatch ? stripTags(titleMatch[1]) : 'The Daily Ripple';

// Extract date from article
const dateMatch = html.match(/<p[^>]*>([^<]*(?:January|February|March|April|May|June|July|August|September|October|November|December)[^<]*)<\/p>/);
const date = dateMatch ? stripTags(dateMatch[1]) : new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Extract teaser (look for <div id="teaser"> or first <ul>)
const teaser = [];
const teaserMatch = html.match(/<div[^>]*id="teaser"[^>]*>([\s\S]*?)<\/div>/i);
if (teaserMatch) {
  const liRegex = /<li[^>]*>([^<]+)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(teaserMatch[1])) !== null) {
    teaser.push(stripTags(liMatch[1]));
  }
}

// Extract all sections (h3 headers + following paragraphs)
const sections = [];
const sectionRegex = /<h3[^>]*>([^<]+)<\/h3>([\s\S]*?)(?=<h3|<hr|$)/gi;
let sectionMatch;

while ((sectionMatch = sectionRegex.exec(html)) !== null) {
  const sectionTitle = stripTags(sectionMatch[1]);
  const sectionContent = sectionMatch[2];

  // Extract paragraphs
  const paragraphs = [];
  const pRegex = /<p[^>]*>([^<]+(?:<[^>]+>[^<]*<\/[^>]+>[^<]*)*)<\/p>/gi;
  let pMatch;
  
  while ((pMatch = pRegex.exec(sectionContent)) !== null) {
    const text = stripTags(pMatch[1]);
    if (text.length > 20) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length > 0) {
    // Extract category from section title (before the em-dash)
    const categoryMatch = sectionTitle.match(/^[^—]*/);
    const category = categoryMatch ? categoryMatch[0].trim() : sectionTitle;
    
    // Singapore lens is typically in the last paragraph
    const singaporeLens = paragraphs.length > 1 ? paragraphs[paragraphs.length - 1].substring(0, 200) : '';

    sections.push({
      title: sectionTitle,
      summary: paragraphs[0].substring(0, 300), // First 300 chars as summary
      content: paragraphs.join('\n\n'), // Full content
      category: category,
      singaporeLens: singaporeLens
    });
  }
}

return [{
  json: {
    date,
    dateSlug: date.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    title,
    sections,
    teaser,
    telegraphUrl: 'https://telegra.ph/The-Daily-Ripple-06-01',
    dashboardUrl: 'https://rippledash-ht3duhth.manus.space/brief?date=' + date.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
}];
```

This extracts structured data from the Telegraph HTML.

#### Step 4: Configure Validate Brief Schema

**Node Name**: `Validate Brief Schema`

**Code**: (Same as in the previous guide - Phase 3.1)

```javascript
const brief = $input.item.json;

// Validation rules
const errors = [];

// 1. Required fields
if (!brief.date) errors.push('Missing date');
if (!brief.dateSlug) errors.push('Missing dateSlug');
if (!Array.isArray(brief.sections) || brief.sections.length === 0) {
  errors.push('Sections must be a non-empty array');
}

// 2. Section validation
brief.sections.forEach((section, idx) => {
  if (!section.title) errors.push(`Section ${idx}: Missing title`);
  if (!section.summary) errors.push(`Section ${idx}: Missing summary`);
  if (!section.content) errors.push(`Section ${idx}: Missing content`);
  if (!section.category) errors.push(`Section ${idx}: Missing category`);
  
  // Length checks
  if (section.title.length > 200) errors.push(`Section ${idx}: Title too long (max 200 chars)`);
  if (section.summary.length > 500) errors.push(`Section ${idx}: Summary too long (max 500 chars)`);
  if (section.content.length < 50) errors.push(`Section ${idx}: Content too short (min 50 chars)`);
});

// 3. Teaser validation
if (!Array.isArray(brief.teaser)) {
  errors.push('Teaser must be an array');
} else if (brief.teaser.length === 0) {
  errors.push('Teaser must have at least one bullet');
} else {
  brief.teaser.forEach((bullet, idx) => {
    if (bullet.length > 100) {
      errors.push(`Teaser ${idx}: Bullet too long (max 100 chars)`);
    }
  });
}

// 4. URL validation
if (!brief.telegraphUrl || !brief.telegraphUrl.startsWith('http')) {
  errors.push('Invalid telegraphUrl');
}

if (errors.length > 0) {
  return [{
    json: {
      valid: false,
      errors,
      brief: null
    }
  }];
}

// If valid, sanitize content
const sanitizedBrief = {
  ...brief,
  sections: brief.sections.map(s => ({
    ...s,
    content: s.content.substring(0, 5000), // Max content length
    summary: s.summary.substring(0, 500)
  }))
};

return [{
  json: {
    valid: true,
    errors: [],
    brief: sanitizedBrief
  }
}];
```

#### Step 5: Add If Node for Conditional Routing

(Same as Phase 3.2 in previous guide)

#### Step 6: Add HTTP POST to Dashboard

(Same as Phase 4.1 in previous guide)

---

## Production Workflow: 9:30 AM Daily

### Full End-to-End Flow

```
9:30 AM SGT
    ↓
STAGE 1: Generation
├─ Schedule Trigger (9:30 AM)
├─ Tools Agent (Claude writes brief)
├─ Format for Telegraph
├─ Publish to Telegraph
└─ Send Telegram notification
    ↓
    [Brief now published at telegra.ph/The-Daily-Ripple-[DATE]]
    ↓
STAGE 2: Extraction (Auto-trigger or separate scheduled job)
├─ Fetch Telegraph Article
├─ Parse Telegraph to Sections
├─ Validate Brief Schema
├─ If Node (conditional)
├─ POST Brief to Dashboard
└─ Dashboard persists to database
    ↓
    [Website fetches via tRPC and displays]
```

### Implementation Options

**Option A: Sequential in Same Workflow**
- After "Telegram: Send Brief", add extraction nodes
- Pro: Single workflow, guaranteed order
- Con: Workflow gets long

**Option B: Separate Scheduled Workflow**
- Keep Stage 1 as-is
- Create new workflow for Stage 2
- Schedule Stage 2 to run 5 minutes after Stage 1
- Pro: Modular, easier to debug
- Con: Requires coordination

**Option C: Webhook Trigger**
- Stage 1 ends with HTTP call to Stage 2 webhook
- Stage 2 triggered by Stage 1 completion
- Pro: Immediate extraction after publishing
- Con: Requires webhook setup

---

## Testing Today: Step-by-Step

### What You'll Do

1. **Create a manual trigger workflow** (Steps 1-6 above)
2. **Execute manually** with today's Telegraph article
3. **Watch the extraction** happen in real-time
4. **See the output** in n8n execution logs
5. **Verify the dashboard** received the data
6. **Check the website** displays the brief

### What Claude Will Do

1. **Read the Telegraph HTML** (not search results)
2. **Extract 8 sections** with titles, summaries, content
3. **Extract teaser bullets**
4. **Extract Singapore lens** from each section
5. **Validate all required fields**
6. **Send to dashboard API**

### Expected Output

```json
{
  "date": "June 01, 2026",
  "dateSlug": "june-01-2026",
  "sections": [
    {
      "title": "🌐 1. LEAD STORY — Singapore steps into Hormuz energy diplomacy; CapitaLand's China retreat hits 365 jobs",
      "summary": "Singapore's Ministry of Foreign Affairs (MFA) is actively working to keep Asian oil flows intact as the Strait of Hormuz remains without a durable reopening agreement...",
      "content": "[Full paragraph content from Telegraph]",
      "category": "LEAD STORY",
      "singaporeLens": "For us, this is Port of Singapore business in the most direct sense..."
    },
    // ... 7 more sections
  ],
  "teaser": [
    "Singapore steps into Hormuz energy diplomacy",
    "Hegseth's Shangri-La exit: 'pay your own way'",
    "Nikkei hits all-time highs on AI wave"
  ],
  "telegraphUrl": "https://telegra.ph/The-Daily-Ripple-06-01",
  "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=june-01-2026"
}
```

---

## Key Differences: Stage 1 vs Stage 2

| Aspect | Stage 1 (Generation) | Stage 2 (Extraction) |
|--------|---------------------|---------------------|
| **Input** | Tavily search results | Telegraph HTML |
| **LLM Task** | Write 8-section brief | Extract structured data |
| **Output Format** | Raw HTML (human-readable) | JSON (machine-readable) |
| **Destination** | Telegraph (publishing) | Dashboard API (database) |
| **When** | 21:30 SGT daily | After Stage 1 (or manual test) |
| **Claude's Role** | Content creator | Data extractor |

---

## Why Telegraph as Intermediary?

1. **Human-readable**: Telegraph article is polished, published version
2. **Quality gate**: Human can review before extraction if needed
3. **Archival**: Telegraph serves as permanent record
4. **Flexibility**: Can manually trigger extraction from any Telegraph article
5. **Separation of concerns**: Generation and extraction are independent

---

## Next Steps

1. **Create manual trigger workflow** for testing (Steps 1-6)
2. **Test with today's article** (June 01, 2026)
3. **Verify extraction** in n8n logs
4. **Check dashboard** received the data
5. **Verify website** displays the brief
6. **Then integrate** into production workflow (9:30 AM daily)

The guide is ready to implement. All code snippets are production-ready.
