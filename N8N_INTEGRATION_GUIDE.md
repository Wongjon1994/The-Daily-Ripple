# n8n Integration Guide for Ripple Dashboard

This guide explains how to configure an n8n workflow to automatically publish daily briefs to the Ripple Dashboard.

## System Architecture

The Ripple Dashboard has been configured with a complete backend system to receive daily briefs from n8n:

### Database Schema
- **n8nBriefs table**: Stores briefs published via n8n workflow
  - `id` (int): Primary key
  - `date` (varchar): Human-readable date, e.g., "May 31, 2026"
  - `dateSlug` (varchar): URL-friendly slug, e.g., "may-31-2026" (unique)
  - `sections` (json): Array of brief sections with full content
  - `telegraphUrl` (varchar): Optional Telegraph publication URL
  - `dashboardUrl` (varchar): Generated dashboard URL for the brief
  - `rawPayload` (json): Raw n8n payload for reference
  - `createdAt` (timestamp): When brief was published
  - `updatedAt` (timestamp): Last update time

### API Endpoints

#### 1. POST /api/scheduled/publish-n8n-brief
**Purpose**: Receive and store daily briefs from n8n workflow

**Request Body**:
```json
{
  "date": "May 31, 2026",
  "dateSlug": "may-31-2026",
  "sections": [
    {
      "title": "Section Title",
      "summary": "Brief summary",
      "content": "Full content text",
      "category": "Category Name",
      "singaporeLens": "Singapore-specific context"
    }
  ],
  "telegraphUrl": "https://telegra.ph/...",
  "rawPayload": {}
}
```

**Response**:
```json
{
  "ok": true,
  "briefId": "may-31-2026",
  "dashboardUrl": "https://rippledash-ht3duhth.manus.space/brief?date=may-31-2026",
  "telegraphUrl": "https://telegra.ph/..."
}
```

**Error Handling**:
- Returns 400 if required fields are missing (date, dateSlug, sections)
- Returns 500 if database error occurs
- All errors include timestamp for debugging

#### 2. GET /api/n8n-brief
**Purpose**: Retrieve latest published brief (public endpoint)

**Query Parameters**:
- `slug` (optional): Specific date slug, e.g., "may-31-2026"

**Response**:
```json
{
  "ok": true,
  "brief": {
    "id": 1,
    "date": "May 31, 2026",
    "dateSlug": "may-31-2026",
    "sections": [...],
    "telegraphUrl": "...",
    "dashboardUrl": "...",
    "createdAt": "2026-05-31T08:00:00.000Z",
    "updatedAt": "2026-05-31T08:00:00.000Z"
  }
}
```

## n8n Workflow Configuration

### Step 1: Create HTTP Request Node

**Node Configuration**:
- **Method**: POST
- **URL**: `https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief`
- **Authentication**: None (public endpoint)
- **Headers**: 
  - `Content-Type: application/json`

### Step 2: Map Telegraph Brief to Payload

Use the **Function Node** to transform Telegraph HTML brief into structured JSON:

```javascript
// Input: Telegraph brief HTML content
// Output: Structured payload for dashboard

const briefHtml = $input.all()[0].json.content; // Your Telegraph brief HTML

// Parse sections using regex or HTML parser
const sections = [];

// Example section structure
sections.push({
  title: "Section Title",
  summary: "2-3 sentence summary",
  content: "Full paragraph content",
  category: "Geopolitics|Economics|Technology|Culture",
  singaporeLens: "Singapore-specific context or impact"
});

return {
  date: "May 31, 2026",
  dateSlug: "may-31-2026",
  sections: sections,
  telegraphUrl: "https://telegra.ph/...",
  rawPayload: $input.all()[0].json
};
```

### Step 3: Configure Heartbeat Schedule

Use Manus Heartbeat to schedule daily brief publishing:

**Heartbeat Configuration**:
```
Name: publish-daily-brief
Cron: 0 0 9 * * * (Daily at 09:00 UTC)
Path: /api/scheduled/publish-n8n-brief
Method: POST
Payload: (See Step 2 output)
```

## Frontend Integration

### Displaying n8n Briefs

The frontend component `BriefPageEnhanced.tsx` is configured to:
1. Display briefs in a premium bento box layout
2. Support swipe navigation between stories
3. Provide expand/collapse functionality
4. Show Singapore Lens callouts
5. Persist font size preferences

### Accessing Published Briefs

**Latest Brief**:
```
GET /api/n8n-brief
```

**Specific Brief by Date**:
```
GET /api/n8n-brief?slug=may-31-2026
```

**Dashboard URL**:
```
https://rippledash-ht3duhth.manus.space/brief?date=may-31-2026
```

## Testing the Integration

### 1. Test API Endpoint Directly

```bash
curl -X POST https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief \
  -H "Content-Type: application/json" \
  -d '{
    "date": "June 1, 2026",
    "dateSlug": "june-1-2026",
    "sections": [
      {
        "title": "Test Section",
        "summary": "Test summary",
        "content": "Test content",
        "category": "Test",
        "singaporeLens": "Test lens"
      }
    ]
  }'
```

### 2. Verify Database Storage

```sql
SELECT * FROM n8n_briefs ORDER BY createdAt DESC LIMIT 1;
```

### 3. Test Frontend Display

Visit: `https://rippledash-ht3duhth.manus.space/brief?date=june-1-2026`

## Section Structure Reference

Each section in the `sections` array should follow this structure:

```typescript
{
  title: string;              // Story headline
  summary: string;            // 2-3 sentence summary
  content: string;            // Full paragraph content (no truncation)
  category: string;           // One of: Geopolitics, Economics, Technology, Culture, Markets, Science, Society
  singaporeLens: string;      // Singapore-specific context or impact
  readingTime?: number;       // Optional: estimated reading time in minutes
  source?: string;            // Optional: source attribution
}
```

## Error Handling & Debugging

### Common Issues

1. **400 Bad Request**: Missing required fields
   - Ensure `date`, `dateSlug`, and `sections` are provided
   - `sections` must be an array

2. **500 Internal Server Error**: Database connection issue
   - Check database URL is configured
   - Verify database is accessible
   - Check application logs for details

3. **Brief not displaying**: Check dateSlug format
   - Should be lowercase with hyphens: "may-31-2026"
   - Must be unique in database

### Debugging Steps

1. Check API response status and error message
2. Verify database has the record: `SELECT * FROM n8n_briefs WHERE dateSlug = 'may-31-2026'`
3. Check frontend console for any parsing errors
4. Verify section data structure matches expected format

## Production Deployment

Before deploying to production:

1. **Test the workflow** with sample data
2. **Verify database connectivity** and migrations are applied
3. **Test the frontend display** with published briefs
4. **Set up monitoring** for the scheduled endpoint
5. **Configure error notifications** for failed publishes

## Support & Maintenance

- Monitor `/api/scheduled/publish-n8n-brief` endpoint for errors
- Check database for orphaned or malformed records
- Validate n8n workflow output before publishing
- Keep section structure consistent for reliable parsing

---

**Last Updated**: June 1, 2026
**Version**: 1.0
**Status**: Ready for n8n integration


## Setting Up the n8n Workflow

### Prerequisites
- n8n instance running (self-hosted or cloud)
- Access to the Ripple Dashboard API endpoint
- Daily brief content source (Telegraph, RSS feed, or manual input)

### Workflow Configuration

#### Step 1: Create a New Workflow in n8n

1. Log in to your n8n instance
2. Click "New Workflow"
3. Name it: "Ripple Dashboard Daily Brief Publisher"
4. Save the workflow

#### Step 2: Add HTTP Request Node

1. Add an **HTTP Request** node to your workflow
2. Configure the following:
   - **Method**: POST
   - **URL**: `https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief`
   - **Headers**: 
     - `Content-Type: application/json`
   - **Body** (use Expression mode):
     ```json
     {
       "date": "{{ $now.format('MMMM D, YYYY') }}",
       "dateSlug": "{{ $now.format('MMMM-D-YYYY').toLowerCase() }}",
       "sections": [
         {
           "title": "{{ item.title }}",
           "summary": "{{ item.summary }}",
           "content": "{{ item.content }}",
           "category": "{{ item.category }}",
           "singaporeLens": "{{ item.singaporeLens }}"
         }
       ],
       "telegraphUrl": "{{ item.telegraphUrl || null }}"
     }
     ```

#### Step 3: Add Data Source Node

Choose one of the following based on your brief source:

**Option A: Manual Input (for testing)**
- Use a **Function** node to hardcode test data
- Structure sections according to the schema above

**Option B: Telegraph Integration**
- Add a **Telegraph** node to fetch published articles
- Parse the content into sections

**Option C: RSS Feed**
- Add an **RSS** node to fetch daily news
- Transform feed items into brief sections

**Option D: Webhook (for external sources)**
- Add a **Webhook** node to receive briefs from external systems
- Validate and transform the payload

#### Step 4: Add Schedule Trigger

1. Add a **Cron** node or **Schedule** node
2. Configure timing:
   - **Frequency**: Daily
   - **Time**: 6:00 AM (or your preferred time)
   - **Timezone**: UTC or your local timezone

#### Step 5: Error Handling

Add an **Error Handler** node:
1. Connect to the HTTP Request node
2. Add a **Notification** node to alert on failures
3. Log errors to your monitoring system

#### Step 6: Test the Workflow

1. Click "Execute Workflow"
2. Check the API response in the HTTP Request node
3. Verify the brief appears in the dashboard at: `https://rippledash-ht3duhth.manus.space/brief?date=<date-slug>`

### Example n8n Workflow JSON

```json
{
  "nodes": [
    {
      "parameters": {
        "expression": "={\n  \"date\": $now.format('MMMM D, YYYY'),\n  \"dateSlug\": $now.format('MMMM-D-YYYY').toLowerCase(),\n  \"sections\": [\n    {\n      \"title\": \"Daily Geopolitical Update\",\n      \"summary\": \"Today's key geopolitical developments\",\n      \"content\": \"Full content here\",\n      \"category\": \"Geopolitics\",\n      \"singaporeLens\": \"Impact on Singapore\"\n    }\n  ]\n}"
      },
      "name": "Generate Brief Payload",
      "type": "n8n-nodes-base.functionItem",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://rippledash-ht3duhth.manus.space/api/scheduled/publish-n8n-brief",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "bodyParametersUi": "json",
        "body": "={{ $node[\"Generate Brief Payload\"].json }}"
      },
      "name": "Publish to Dashboard",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "minute": [0],
        "hour": [6],
        "dayOfWeek": []
      },
      "name": "Daily Schedule",
      "type": "n8n-nodes-base.cron",
      "typeVersion": 1,
      "position": [50, 300]
    }
  ],
  "connections": {
    "Daily Schedule": {
      "main": [[{ "node": "Generate Brief Payload", "type": "main", "index": 0 }]]
    },
    "Generate Brief Payload": {
      "main": [[{ "node": "Publish to Dashboard", "type": "main", "index": 0 }]]
    }
  }
}
```

### Monitoring & Maintenance

1. **Check Execution History**: Monitor workflow runs in n8n
2. **Verify API Responses**: Look for 200 status codes
3. **Monitor Dashboard**: Confirm briefs appear daily
4. **Set Up Alerts**: Configure notifications for failed publishes
5. **Review Logs**: Check application logs for errors

### Troubleshooting

**Workflow not triggering?**
- Verify n8n instance is running
- Check cron schedule configuration
- Ensure timezone is correct

**API returns 400 Bad Request?**
- Validate JSON payload structure
- Ensure all required fields are present
- Check date format: "Month D, YYYY"

**Brief not displaying?**
- Verify dateSlug format (lowercase with hyphens)
- Check database for the record
- Confirm frontend is fetching latest data

---

**Last Updated**: June 6, 2026
**Version**: 1.1
**Status**: Workflow setup guide added - ready for implementation
