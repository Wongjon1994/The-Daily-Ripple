# Date-Based Database Functionality for Ripple Dashboard

## Overview

The Ripple Dashboard uses a date-based database architecture to store and retrieve daily intelligence briefs. This system enables automatic loading of briefs from the database, eliminating the need to hardcode briefs in the frontend code. The architecture is designed to scale sustainably as briefs accumulate over months and years.

## Database Schema

### Core Table: `n8nBriefs`

The `n8nBriefs` table stores all published briefs from the n8n workflow automation system:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | INT (Primary Key) | Unique identifier for each brief |
| `date` | VARCHAR(64) | Human-readable date (e.g., "June 3, 2026") |
| `dateSlug` | VARCHAR(64) | URL-friendly date slug (e.g., "june-3-2026") - UNIQUE |
| `sections` | JSON | Array of brief sections with full content |
| `telegraphUrl` | VARCHAR(255) | Optional Telegraph publication URL |
| `dashboardUrl` | VARCHAR(255) | Dashboard URL for this brief |
| `rawPayload` | JSON | Raw n8n workflow output for reference |
| `createdAt` | TIMESTAMP | When brief was published |
| `updatedAt` | TIMESTAMP | Last update timestamp |

**Key Design Decisions:**
- `dateSlug` is UNIQUE to prevent duplicate briefs for the same date
- `date` field stores the human-readable format for display
- JSON columns store flexible nested structures (sections, signals, metadata)
- Timestamps enable sorting and archival workflows

## Data Flow: From n8n to Dashboard

### Step 1: Brief Generation (n8n Workflow)

The n8n workflow generates a structured brief payload:

```json
{
  "date": "June 3, 2026",
  "dateSlug": "june-3-2026",
  "sections": [
    {
      "category": "Geopolitics",
      "headline": "Iran fires on US troops...",
      "body": "...",
      "keyMetrics": [...]
    }
  ]
}
```

### Step 2: Brief Publishing (Backend API)

The `n8n.publish` tRPC mutation receives the payload and stores it:

```typescript
// server/routers.ts
publish: protectedProcedure
  .input(z.object({
    date: z.string(),
    dateSlug: z.string(),
    sections: z.array(z.any()),
    // ... other fields
  }))
  .mutation(async ({ input, ctx }) => {
    await publishN8nBrief({
      date: input.date,
      dateSlug: input.dateSlug,
      sections: input.sections,
      // ...
    });
  })
```

**Database Helper:**
```typescript
// server/db.ts
export async function publishN8nBrief(brief: InsertN8nBrief): Promise<void> {
  await db.insert(n8nBriefs).values(brief).onDuplicateKeyUpdate({
    set: {
      sections: brief.sections,
      telegraphUrl: brief.telegraphUrl,
      dashboardUrl: brief.dashboardUrl,
    },
  });
}
```

This uses MySQL's `ON DUPLICATE KEY UPDATE` to handle updates if a brief for the same date already exists.

### Step 3: Brief Retrieval (Frontend)

The frontend calls `n8n.getAll` to fetch all briefs:

```typescript
// client/src/pages/BriefPageEnhanced.tsx
const { data: allBriefsData } = trpc.n8n.getAll.useQuery();

const allBriefs = allBriefsData?.briefs || [];
```

**Backend Procedure:**
```typescript
// server/routers.ts
getAll: publicProcedure.query(async () => {
  const briefs = await getAllN8nBriefs();
  return { ok: true, briefs: briefs || [] };
})
```

**Database Helper:**
```typescript
// server/db.ts
export async function getAllN8nBriefs() {
  const results = await db
    .select()
    .from(n8nBriefs)
    .orderBy(desc(n8nBriefs.createdAt));
  return results;
}
```

### Step 4: Client-Side Processing

Once briefs are loaded, the frontend:

1. **Detects the latest brief** using date comparison
2. **Groups briefs by week** (Monday-Sunday) using `weekUtils.ts`
3. **Filters to current week** for the Trends dashboard
4. **Populates the brief selector** with week-based grouping

```typescript
// client/src/lib/weekUtils.ts
export function getWeekKey(date: string): string {
  const d = new Date(date);
  const monday = new Date(d);
  monday.setDate(d.getDate() - d.getDay() + 1);
  return formatBriefDate(monday);
}

export function groupBriefsByWeek(briefs: DailyBrief[]): Record<string, DailyBrief[]> {
  const grouped: Record<string, DailyBrief[]> = {};
  briefs.forEach(brief => {
    const weekKey = getWeekKey(brief.date);
    if (!grouped[weekKey]) grouped[weekKey] = [];
    grouped[weekKey].push(brief);
  });
  return grouped;
}
```

## Scaling to Months of Briefs

### Current Architecture (Hardcoded)

The current implementation stores briefs as static TypeScript objects:

```typescript
// client/src/lib/june3Brief.ts
export const june3Brief: DailyBrief = {
  date: "June 3, 2026",
  sections: { /* ... */ }
};
```

**Limitations:**
- Requires manual code updates to add new briefs
- Not scalable beyond a few weeks
- No archival or search capability

### Proposed Architecture (Database-Driven)

With the new database functionality:

1. **New briefs auto-populate** from the database
2. **No frontend code changes** needed
3. **Automatic week-based grouping** in the dropdown
4. **Unlimited scalability** as briefs accumulate

## Dropdown UX for Month of Briefs

### Current Design

The `WeeklyBriefSelector` component groups briefs by week:

```
This Week (May 27 - June 2, 2026)
  ✓ May 31, 2026
  ✓ June 1, 2026
  ✓ June 2, 2026

Last Week (May 20 - May 26, 2026)
  ✓ May 27, 2026
  ✓ May 28, 2026
  ✓ May 29, 2026

Archive
  ▼ April 2026 (22 briefs)
  ▼ March 2026 (20 briefs)
```

### How It Handles a Month of Briefs

**Week-Based Grouping:**
- Automatically groups 20-25 daily briefs into 4-5 weeks
- Each week shows 5-6 briefs (Monday-Friday typically)
- Reduces visual clutter from a flat list of 20+ items

**Archive Collapsible:**
- Older weeks collapse into monthly archives
- Users can expand "April 2026" to see all 22 briefs from that month
- Maintains performance even with 100+ briefs

**Example with 30 Days:**

```
This Week (May 27 - June 2, 2026) — 4 briefs
  ✓ May 31, 2026
  ✓ June 1, 2026
  ✓ June 2, 2026
  ✓ June 3, 2026

Last Week (May 20 - May 26, 2026) — 5 briefs
  ✓ May 20, 2026
  ✓ May 21, 2026
  ✓ May 22, 2026
  ✓ May 23, 2026
  ✓ May 24, 2026

Archive — 21 briefs
  ▼ May 2026 (17 briefs)
    ✓ May 13, 2026
    ✓ May 14, 2026
    ... (13 more)
  ▼ April 2026 (4 briefs)
    ✓ April 30, 2026
    ✓ April 29, 2026
    ... (2 more)
```

### Performance Characteristics

| Metric | Value |
|--------|-------|
| Briefs per week | 5-6 |
| Weeks per month | 4-5 |
| Briefs per month | 20-25 |
| Dropdown items (current week visible) | 4-6 |
| Dropdown items (with last week) | 10-12 |
| Archive items (collapsed) | 1-2 |
| Total dropdown height | ~300-400px |

This design maintains usability even with 12+ months of briefs (250+ total items).

## Integration with Existing Components

### TrendsDashboard

Automatically filters to current week:

```typescript
const currentWeekBriefs = useMemo(() => {
  const latestBrief = briefs.reduce((latest, current) =>
    compareDates(current.date, latest.date) > 0 ? current : latest
  );
  const latestWeekMonday = getMondayOfWeek(latestBrief.date);
  return briefs.filter(brief => isSameWeek(brief.date, latestBrief.date));
}, [briefs]);
```

### WeeklyBriefSelector

Automatically groups and displays:

```typescript
const groupedBriefs = useMemo(() => {
  return groupBriefsByWeek(briefs);
}, [briefs]);
```

### BriefPageEnhanced

Loads all briefs from database:

```typescript
const { data: allBriefsData } = trpc.n8n.getAll.useQuery();
const allBriefs = allBriefsData?.briefs || [];
```

## Future Enhancements

1. **Pagination:** Load briefs in chunks (e.g., 30 at a time) for better performance
2. **Search:** Full-text search across brief content
3. **Filtering:** Filter by category, date range, or signal type
4. **Caching:** Client-side caching to reduce database queries
5. **Webhooks:** Real-time updates when new briefs are published

## Summary

The date-based database functionality provides:

- **Automatic brief loading** without code changes
- **Sustainable scaling** to months and years of briefs
- **Week-based organization** for intuitive navigation
- **Archive support** for older briefs
- **Foundation for future features** like search and filtering

This architecture transforms the dashboard from a static, manually-updated system to a dynamic, automatically-populated intelligence platform.
