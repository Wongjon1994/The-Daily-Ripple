# n8n Hybrid Integration Guide for Ripple Dashboard

## Overview

This guide walks you through configuring your n8n workflow to test with today's Telegraph article using the **Hybrid Approach**: LLM extraction with backend validation for safety.

**Architecture**:

1. **n8n (Client-side)**: Runs the Tools Agent to extract structured brief data from Telegraph HTML

1. **Ripple Dashboard (Server-side)**: Validates payload schema, sanitizes content, and persists to database

1. **Frontend**: Fetches and displays the validated brief via tRPC

---

## Phase 1: Prepare Your n8n Workflow

### Step 1.1: Review Your Current Workflow Structure

Your workflow (`DailyRippleMVP1.8forClaude`) has this flow:

```
Schedule Trigger
  ↓
Set Date
  ↓
Read Memory
  ↓
Tools Agent (Claude with Tavily search)
  ↓
Code: Format for Telegra.ph
  ↓
Publish to Telegraph
  ↓
Telegram: Send Brief
```

For **manual testing with today's article**, you'll:

1. Skip the Schedule Trigger and use Manual Trigger instead

1. Inject the Telegraph URL directly instead of running searches

1. Add a new **HTTP POST node** to send data to your dashboard

1. Keep the Telegraph publishing step (optional for testing)

### Step 1.2: Add Manual Trigger Node

1. In n8n, delete or disable the **Schedule Trigger** node

1. Add a new node: **Trigger** → **Manual Trigger**

1. Position it at the start of your workflow

This allows you to run the workflow manually for testing.

---

## Phase 2: Extract Data from Telegraph

### Step 2.1: Add Telegraph Content Fetcher Node

Since you want to test with the existing Telegraph article, add an **HTTP Request** node to fetch the article HTML:

**Node Name**: `Fetch Telegraph Article`

**Configuration**:

- **Method**: GET

- **URL**: `https://telegra.ph/The-Daily-Ripple-06-01`

- **Response Format**: `Text` (this will return the raw HTML as a string)

- **Options**: Leave defaults

This node will fetch the raw HTML of today's article as plain text. The output will be available in `$input.item.json`.

### Step 2.2: Parse Telegraph HTML to Extract Sections

Add a **Code** node to parse the Telegraph HTML and extract structured data:

**Node Name**: `Parse Telegraph to Sections`

**Code**:
```javascript
const html = $input.item.json.data; // Raw HTML from Telegraph (stored in 'data' field from HTTP node)

// Helper: Extract text between tags
function extractBetween(html, startTag, endTag ) {
  const regex = new RegExp(`${startTag}([\\s\\S]*?)${endTag}`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

// Helper: Strip HTML tags
function stripTags(str) {
  return str.replace(/<[^>]+>/g, '').trim();
}

// Extract title
const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
const title = titleMatch ? stripTags(titleMatch[1]) : 'The Daily Ripple';

// Extract date
const dateMatch = html.match(/<p[^>]*>([^<]*(?:January|February|March|April|May|June|July|August|September|October|November|December)[^<]*)<\/p>/);
const date = dateMatch ? stripTags(dateMatch[1]) : new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Extract all sections (h3 headers + following paragraphs)
const sections = [];
const sectionRegex = /<h3[^>]*>([^<]+)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
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
    sections.push({
      title: sectionTitle,
      summary: paragraphs[0].substring(0, 200), // First 200 chars as summary
      content: paragraphs.join('\n\n'), // Full content
      category: sectionTitle.split('—')[0].trim(), // Extract category from title
      singaporeLens: paragraphs.length > 1 ? paragraphs[1].substring(0, 150) : '' // Second para as lens
    });
  }
}

// Extract teaser bullets
const teaserMatch = html.match(/<div[^>]*id="teaser"[^>]*>([\s\S]*?)<\/div>/i);
const teaser = [];
if (teaserMatch) {
  const liRegex = /<li[^>]*>([^<]+)<\/li>/gi;
  let liMatch;
  while ((liMatch = liRegex.exec(teaserMatch[1])) !== null) {
    teaser.push(stripTags(liMatch[1]));
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
    dashboardUrl: 'https://rippledash-ht3duhth.manus.space/brief?date=' + date.toLowerCase( ).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }
}];
```

This extracts:

- Date and title

- All sections with title, summary, content, category, and Singapore lens

- Teaser bullets

- URLs for Telegraph and dashboard

---

## Phase 3: Implement Hybrid Validation

### Step 3.1: Add Validation Node (Client-side in n8n)

Add a **Code** node to validate the extracted data before sending to the dashboard:

**Node Name**: `Validate Brief Schema`

**Code**:

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
if (!brief.telegraphUrl || !brief.telegraphUrl.startsWith('http' )) {
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

This validates:

- Required fields present

- Section structure correct

- Content length within limits

- URLs valid

- Returns sanitized brief ready for backend

### Step 3.2: Add Conditional Logic

Add an **If** node to check validation result and route to different paths based on success or failure.

#### Creating the If Node

1. **Add the If node**:
   - Click the **+** button to add a new node
   - Search for and select **If** (under Flow)
   - Position it after the `Validate Brief Schema` node
   - Connect the output of `Validate Brief Schema` to the If node

2. **Configure the condition**:
   - In the If node, you'll see a **Condition** section
   - Click **Add Condition**
   - Set the first dropdown to: **Condition**
   - In the expression field, enter: `$json.valid`
   - In the operator dropdown, select: **equals**
   - In the value field, enter: `true` (or select from boolean options)
   - This creates the rule: `$json.valid === true`

3. **Understanding the output branches**:
   - The If node automatically creates **two output branches**:
     - **Top output (True branch)**: Executes when condition is true (validation passed)
     - **Bottom output (False branch)**: Executes when condition is false (validation failed)
   - You'll see these as two connection points on the right side of the If node

#### Connecting the True Branch

1. From the **top output** of the If node, drag a connection to your `POST Brief to Dashboard` node
2. This ensures the validated brief is sent to the API only when validation passes

#### Connecting the False Branch

1. From the **bottom output** of the If node, add a new **Telegram** node
2. Name it: `Notify: Validation Error`
3. This will send error notifications when validation fails (see Phase 7.1 for details)

**Visual Flow**:
```
Validate Brief Schema
        ↓
      If Node
      ↙      ↘
   TRUE      FALSE
     ↓          ↓
  POST API   Telegram Error
```

**Condition Reference**:
- **Expression**: `$json.valid` (the field from Validate Brief Schema output)
- **Operator**: `equals`
- **Value**: `true`

---

## Phase 4: Send to Ripple Dashboard API

### Step 4.1: Add HTTP POST Node to Dashboard

Add an **HTTP Request** node to send the validated brief to your dashboard:

**Node Name**: `POST Brief to Dashboard`

**Configuration**:

- **Method**: POST

- **URL**: `https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief`

- **Authentication**: None (for testing; add auth in production)

#### Body Configuration

```json
{
  "date": "{{ $json.brief.date }}",
  "dateSlug": "{{ $json.brief.dateSlug }}",
  "sections": "={{ $json.brief.sections }}",
  "telegraphUrl": "{{ $json.brief.telegraphUrl }}",
  "dashboardUrl": "{{ $json.brief.dashboardUrl }}"
}
```

#### Options Tab Configuration

1. **Response section**:
   - **Include Response Header**: OFF (toggle disabled)
   - **Never Error**: OFF (toggle disabled)
   - **Response Format**: `Autodetect` (will automatically parse JSON responses)

#### Understanding the Response

With **Autodetect** response format, n8n will automatically parse the JSON response from the dashboard API:

**Success Response** (HTTP 200):
```json
{
  "ok": true,
  "briefId": "june-01-2026",
  "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=june-01-2026",
  "telegraphUrl": "https://telegra.ph/The-Daily-Ripple-06-01"
}
```

Access in next nodes via:
- `$json.ok` → `true`
- `$json.briefId` → `"june-01-2026"`
- `$json.dashboardUrl` → Full URL

**Error Response** (HTTP 400/500):
```json
{
  "error": "Missing required fields: sections",
  "timestamp": "2026-06-01T05:42:00.000Z"
}
```

Access in next nodes via:
- `$json.error` → Error message
- `$json.timestamp` → When error occurred

#### Debugging the Response

1. After execution, click on the `POST Brief to Dashboard` node
2. In the output panel, you'll see the full response object
3. Expand the response to see all fields returned by the API
4. If the request fails, check:
   - HTTP status code (200 = success, 4xx = client error, 5xx = server error)
   - Error message in the response
   - Network tab in browser DevTools to verify the request was sent

---

## Phase 5: Test the Workflow

### Step 5.1: Manual Execution

1. In n8n, open your workflow

1. Click **Execute Workflow** (play button)

1. Watch the execution flow:
  - ✅ Manual Trigger fires
  - ✅ Fetch Telegraph Article retrieves HTML
  - ✅ Parse Telegraph to Sections extracts data
  - ✅ Validate Brief Schema checks schema
  - ✅ POST Brief to Dashboard sends to your API
  - ✅ Dashboard returns `{ ok: true, briefId: "..." }`

### Step 5.2: Verify in Dashboard

1. Open your dashboard: `https://rippledash-ht3duhth.manus.space`

1. The brief should load automatically (tRPC query fetches latest )

1. Sections should display in bento boxes

1. Swipe and expand to verify content

### Step 5.3: Check Database

Query your database to verify the brief was persisted:

```sql
SELECT id, date, dateSlug, createdAt FROM n8nBriefs 
ORDER BY createdAt DESC LIMIT 1;
```

---

## Phase 6: Error Handling & Debugging

### Common Issues

| Issue | Cause | Fix |
| --- | --- | --- |
| `Parse Telegraph to Sections` fails | HTML structure changed | Update regex patterns in code node |
| `Validate Brief Schema` rejects data | Missing required fields | Check Telegraph article has all sections |
| `POST Brief to Dashboard` returns 400 | Payload schema mismatch | Verify JSON structure matches API schema |
| Dashboard shows "Loading..." forever | tRPC query fails | Check browser console for errors |
| Brief displays but sections are empty | Content extraction failed | Review `Parse Telegraph` output |

### Debug Steps

1. **Check n8n execution logs**: Click on each node to see input/output

1. **Inspect HTTP response**: In `POST Brief to Dashboard`, check response body

1. **Check browser console**: Open DevTools (F12) on dashboard

1. **Query database**: Verify brief was inserted

1. **Check tRPC response**: Open Network tab, filter by `/api/trpc`, check `n8n.getLatest` response

---

## Phase 7: Production Readiness

### Step 7.1: Add Error Notifications

Add a **Telegram** node on the error path to notify you if validation fails:

**Node Name**: `Notify: Validation Error`

**Configuration**:

```
Chat ID: [Your chat ID]
Message: ❌ Brief validation failed:
{{ $json.errors.join('\n') }}

Timestamp: {{ now().format('YYYY-MM-DD HH:mm:ss') }}
```

### Step 7.2: Add Success Notification

Add a **Telegram** node on the success path:

**Node Name**: `Notify: Brief Published`

**Configuration**:

```
Chat ID: [Your chat ID]
Message: ✅ Brief published successfully

Date: {{ $json.brief.date }}
Sections: {{ $json.brief.sections.length }}
Dashboard: {{ $json.brief.dashboardUrl }}
```

### Step 7.3: Enable Schedule Trigger

Once testing is complete:

1. Re-enable the **Schedule Trigger** node

1. Set it to run at 21:30 SGT daily

1. The workflow will now run automatically

---

## Phase 8: Understanding the Hybrid Approach

### Why This Architecture?

**LLM Extraction (n8n)**:

- ✅ Flexible parsing of Telegraph HTML

- ✅ Handles formatting variations

- ✅ Extracts semantic meaning (Singapore lens, category)

- ❌ Can hallucinate or miss fields

**Backend Validation (Dashboard)**:

- ✅ Enforces strict schema

- ✅ Prevents malformed data in database

- ✅ Sanitizes content for security

- ✅ Provides audit trail

### Data Flow

```
Telegraph Article (HTML)
    ↓
n8n: Parse & Extract (flexible, semantic)
    ↓
n8n: Validate Schema (client-side checks)
    ↓
Dashboard API: Validate & Persist (server-side safety)
    ↓
Database: n8nBriefs table
    ↓
Frontend: tRPC query fetches latest
    ↓
User: Reads brief in dashboard
```

### Safety Guarantees

1. **n8n validates** before sending (prevents obvious errors)

1. **Dashboard validates** on receipt (defense in depth)

1. **Database schema** enforces types (SQL-level safety)

1. **tRPC** ensures type safety (frontend receives correct types)

---

## Phase 9: Testing Today's Article

### Test Payload (June 1, 2026)

Your Telegraph article has these sections:

1. **LEAD STORY** — Singapore steps into Hormuz energy diplomacy; CapitaLand's China retreat

1. **GLOBAL POWER & POLICY** — Hegseth's Shangri-La exit; New Jersey ICE protests

1. **MARKETS AND ECONOMICS** — Nikkei hits all-time highs; S&P 500 closes May at records

1. **BUSINESS** — Chipmaker rally raises bubble alarm; Palo Alto Networks earnings

1. **AI, TECHNOLOGY AND FUTURE OF WORK** — (implied in article)

1. **SCIENCE AND HEALTH** — (implied in article)

1. **CULTURE** — (implied in article)

1. **SYSTEMS SYNTHESIS** — (implied in article)

**Expected Extracted Data**:

```json
{
  "date": "June 01, 2026",
  "dateSlug": "june-01-2026",
  "sections": [
    {
      "title": "LEAD STORY — Singapore steps into Hormuz energy diplomacy; CapitaLand's China retreat hits 365 jobs",
      "summary": "Singapore's Ministry of Foreign Affairs (MFA) is actively working to keep Asian oil flows intact...",
      "content": "[Full paragraph content]",
      "category": "LEAD STORY",
      "singaporeLens": "For us, this is Port of Singapore business in the most direct sense..."
    },
    // ... more sections
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

## Phase 10: Next Steps

### After Successful Test

1. **Refine extraction**: If any sections are missing or malformed, update the `Parse Telegraph` regex

1. **Adjust validation**: If validation is too strict, loosen constraints in `Validate Brief Schema`

1. **Enable scheduling**: Switch to Schedule Trigger for daily automated runs

1. **Monitor execution**: Check Telegram notifications daily to catch errors

1. **Iterate on content**: As you publish more briefs, refine the Telegraph formatting to match extraction expectations

### Future Enhancements

- Add LLM-based fact-checking in n8n before sending to dashboard

- Implement A/B testing of different section formats

- Add user feedback loop (thumbs up/down on dashboard ) to improve extraction

- Create admin dashboard to manually override extracted data if needed

- Add multi-language support for international readers

---

## Reference: API Endpoint

**POST** `/api/scheduled/publish-n8n-brief`

**Request Body**:

```json
{
  "date": "June 01, 2026",
  "dateSlug": "june-01-2026",
  "sections": [
    {
      "title": "string",
      "summary": "string",
      "content": "string",
      "category": "string",
      "singaporeLens": "string (optional)"
    }
  ],
  "telegraphUrl": "string",
  "dashboardUrl": "string"
}
```

**Response (Success)**:

```json
{
  "ok": true,
  "briefId": "june-01-2026",
  "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=june-01-2026",
  "telegraphUrl": "https://telegra.ph/The-Daily-Ripple-06-01"
}
```

**Response (Error )**:

```json
{
  "error": "Missing required fields: sections",
  "timestamp": "2026-06-01T05:42:00.000Z"
}
```

---

## Support

For issues or questions:

1. Check the **Error Handling & Debugging** section above

1. Review n8n execution logs for each node

1. Verify Telegraph article structure hasn't changed

1. Check dashboard API logs: `tail -f .manus-logs/devserver.log`

