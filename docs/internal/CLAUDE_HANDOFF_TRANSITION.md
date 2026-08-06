# Ripple Dashboard: Transition Document for Claude Code

**Date**: June 9, 2026  
**Status**: Production-Ready MVP with Manual Brief Upload  
**Next Phase**: n8n Automated Brief Population + Enhanced UX

---

## Executive Summary

The **Ripple Dashboard** is a geopolitical intelligence platform that displays daily briefs organized by signals, trends, and Singapore-centric analysis. The current implementation is **fully functional** with a manual upload workflow powered by hardcoded briefs in the frontend. This document provides Claude Code with:

1. **Current Architecture** - How the system works today
2. **Workflow Transition** - From manual to n8n-automated population
3. **Two Critical Gaps** - Source link accuracy and brief dropdown UX
4. **Open Question** - Trends analysis approach (awaiting user specification)

---

## Part 1: Current Architecture

### Tech Stack

- **Frontend**: React 19 + Tailwind 4 + TypeScript
- **Backend**: Express 4 + tRPC 11 + Drizzle ORM
- **Database**: MySQL (TiDB compatible)
- **Authentication**: Manus OAuth (built-in)
- **LLM Integration**: Claude API (via Manus built-in forge)
- **Hosting**: Manus WebDev (auto-deployed)

### Project Structure

```
ripple-dashboard/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── BriefPageEnhanced.tsx       # Main brief display page
│   │   │   └── Home.tsx                    # Landing page
│   │   ├── components/
│   │   │   ├── BriefCard.tsx               # Individual story card (CRITICAL: source links here)
│   │   │   ├── WeeklyBriefSelector.tsx     # Brief dropdown selector (GAP: needs streamlining)
│   │   │   ├── TrendsDashboard.tsx         # Signal trends view (OPEN: awaiting design spec)
│   │   │   ├── MastheadBanner.tsx          # Header with logo
│   │   │   └── SwipeDemo.tsx               # Story navigation (swipe/keyboard)
│   │   ├── lib/
│   │   │   ├── briefParser.ts              # Parse brief JSON to DailyBrief type
│   │   │   ├── weekUtils.ts                # Group briefs by week
│   │   │   ├── dateUtils.ts                # Date comparison & formatting
│   │   │   ├── signalMapper.ts             # Extract signal threads from briefs
│   │   │   ├── storyMapper.ts              # Map stories to signals by date
│   │   │   ├── singaporeLensMapper.ts      # Synthesize Singapore Lens evolution
│   │   │   ├── trpc.ts                     # tRPC client setup
│   │   │   └── may31Brief.ts, june1Brief.ts, ... # Hardcoded briefs (TEMPORARY)
│   │   └── index.css                       # Global styles + design tokens
├── server/
│   ├── routers.ts                          # tRPC procedures (n8n.*, auth.*, system.*)
│   ├── db.ts                               # Database query helpers
│   ├── _core/
│   │   ├── context.ts                      # Auth context builder
│   │   ├── oauth.ts                        # Manus OAuth handler
│   │   ├── llm.ts                          # Claude API wrapper
│   │   ├── notification.ts                 # Owner notification helper
│   │   └── env.ts                          # Environment variable loader
│   └── storage.ts                          # S3 file storage helpers
├── drizzle/
│   └── schema.ts                           # Database tables (n8nBriefs, briefSignals, etc.)
├── DATABASE_FUNCTIONALITY.md               # DB architecture guide
├── N8N_HYBRID_INTEGRATION_GUIDE.md        # n8n workflow setup
├── HEARTBEAT_SETUP.md                      # Cron job configuration
├── MVP1_SPECIFICATION.md                   # Original MVP spec (user-driven uploads)
└── n8n-workflow-export.json               # n8n workflow definition
```

### Data Flow: Current (Manual)

```
Hardcoded Brief Data (may31Brief.ts, june1Brief.ts, etc.)
  ↓
BriefPageEnhanced.tsx imports all briefs
  ↓
allBriefs object keyed by slug (may31, june1, june2, ...)
  ↓
WeeklyBriefSelector groups by week and displays dropdown
  ↓
User selects date → BriefCard renders sections
  ↓
TrendsDashboard analyzes signals across selected week
```

**Key Limitation**: Adding new briefs requires code changes (new TypeScript file + import).

### Core Components

#### 1. **BriefCard.tsx** (Story Display)

- **Input**: `section: BriefSection` (headline, summary, paragraphs, keyMetrics, sources, singaporeLens)
- **Output**: Collapsible card with full story details
- **Critical Detail**: Sources are rendered as external links at lines 207-231:
  ```tsx
  {section.sources?.map((source) => (
    <a href={source.url} target="_blank" rel="noopener noreferrer">
      {source.outlet} • {source.date}
    </a>
  ))}
  ```
  **GAP**: No validation of `source.url` — inaccurate links pass through unchanged.

#### 2. **WeeklyBriefSelector.tsx** (Brief Picker)

- **Input**: `briefs: Record<string, DailyBrief>` + `selectedBriefKey` + `onSelectBrief`
- **Output**: Dropdown with week-based grouping
- **Current Logic**:
  - Groups briefs into weeks (Monday–Sunday)
  - Labels: "This Week", "Last Week", "2 weeks ago", etc.
  - Archive section collapses older weeks
- **GAP**: Beyond 7 days, all briefs collapse into "Archive" without a calendar/drill-down interface. Users cannot easily access briefs from 2+ weeks ago.

#### 3. **TrendsDashboard.tsx** (Signal Analysis)

- **Input**: `briefs: Record<string, DailyBrief>`
- **Output**: Signals grouped by category (Geopolitics, Markets, Economics, Tech) with expandable cards
- **Current Behavior**: Shows signal values across dates, story evolution, and Singapore Lens
- **OPEN QUESTION**: User wants to specify the exact layout/interaction model for this view. Current implementation groups signals by category; user may want a different organization (e.g., by date columns with clickable story widgets).

#### 4. **BriefPageEnhanced.tsx** (Main Page)

- Orchestrates brief selection, display, and trend analysis
- Imports all hardcoded briefs and passes them to child components
- Provides tabs: "Daily Brief" (story view) and "Trends" (signal analysis)

### Database Schema (Active)

#### `n8nBriefs` Table

```sql
CREATE TABLE n8nBriefs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  date VARCHAR(64) NOT NULL,
  dateSlug VARCHAR(64) NOT NULL UNIQUE,
  sections JSON NOT NULL,
  telegraphUrl VARCHAR(255),
  dashboardUrl VARCHAR(255),
  rawPayload JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Purpose**: Stores briefs published via n8n workflow (future state).  
**Current Status**: Schema exists but table is empty; briefs are hardcoded in frontend.

#### Supporting Tables (Prepared, Not Yet Used)

- `briefSignals` - Extracted signals with confidence scores
- `briefThemes` - Auto-detected themes (oil, Taiwan, geopolitics, etc.)
- `briefMetadata` - Embeddings and search metadata

### API Contract (tRPC Procedures)

#### `n8n.*` Procedures

```typescript
// Fetch latest brief
n8n.getLatest.useQuery()
  → { ok: boolean, brief?: DailyBrief }

// Fetch brief by date slug
n8n.getBySlug.useQuery({ slug: string })
  → { ok: boolean, brief?: DailyBrief }

// Fetch all briefs (for trends/archive)
n8n.getAll.useQuery()
  → { ok: boolean, briefs: DailyBrief[] }

// Publish new brief (admin only)
n8n.publish.useMutation({
  date: string,
  dateSlug: string,
  sections: BriefSection[],
  telegraphUrl?: string,
  dashboardUrl?: string,
  rawPayload?: any
})
  → { ok: boolean, briefId: number, dashboardUrl: string }
```

**Note**: All procedures are already implemented and ready for use. Currently, `getAll` returns hardcoded briefs; after n8n integration, it will query the database.

---

## Part 2: Workflow Transition

### Current Workflow (Manual)

```
1. Editor writes brief in external tool (Google Docs, Telegraph, etc.)
2. Editor manually extracts structured data (8 sections, signals, Singapore Lens)
3. Editor creates new TypeScript file (e.g., june10Brief.ts)
4. Editor imports file in BriefPageEnhanced.tsx
5. Redeploy application
6. Brief appears in dashboard
```

**Limitations**:
- Slow (requires code changes + redeploy)
- Error-prone (manual data entry)
- Not scalable (hundreds of briefs)

### Future Workflow (n8n Automated)

```
1. Editor publishes brief to Telegraph (or uploads HTML/document)
2. n8n workflow triggers (daily at 6 AM UTC or on-demand)
3. n8n fetches Telegraph HTML (or document)
4. n8n runs Claude extraction:
   - Parse 8 sections
   - Extract signals (label, value, trend)
   - Identify themes (oil, Taiwan, geopolitics, etc.)
   - Map Singapore Lens
5. n8n POSTs structured payload to dashboard API:
   POST /api/trpc/n8n.publish
   {
     date: "June 10, 2026",
     dateSlug: "june-10-2026",
     sections: [...],
     telegraphUrl: "https://telegra.ph/...",
     dashboardUrl: "https://rippledash.../june-10-2026"
   }
6. Backend validates payload and stores in n8nBriefs table
7. Frontend queries n8n.getAll() → fetches from database
8. Brief appears in dashboard automatically (no redeploy)
```

**Benefits**:
- Fast (no code changes)
- Accurate (LLM extraction)
- Scalable (unlimited briefs)
- Auditable (raw payload stored)

### Migration Path

**Phase 1: Prepare** (Current)
- ✅ Database schema ready
- ✅ tRPC API ready
- ✅ n8n workflow template ready (n8n-workflow-export.json)

**Phase 2: Test** (Next)
- [ ] Configure n8n workflow with Telegraph URL
- [ ] Test extraction on sample brief
- [ ] Validate payload schema
- [ ] Test API endpoint

**Phase 3: Deploy** (After Validation)
- [ ] Enable n8n workflow (set schedule or manual trigger)
- [ ] Monitor first few briefs
- [ ] Retire hardcoded briefs (remove TypeScript files)
- [ ] Update BriefPageEnhanced to fetch from database only

**Phase 4: Optimize** (Post-Launch)
- [ ] Add theme-based filtering
- [ ] Implement semantic search (embeddings)
- [ ] Add trend analytics dashboard
- [ ] Enable subscriber collaboration

### n8n Workflow Structure

**File**: `n8n-workflow-export.json`

**Nodes**:
1. **Schedule Trigger** - Daily at 6 AM UTC (or manual trigger for testing)
2. **Set Date** - Format today's date
3. **Read Memory** - Fetch Telegraph URL from n8n memory
4. **Tools Agent** - Claude with Tavily search (extracts brief structure)
5. **Code: Format for Telegra.ph** - Prepare HTML for Telegraph
6. **Publish to Telegraph** - POST to Telegraph API
7. **HTTP POST to Dashboard** - POST payload to `/api/trpc/n8n.publish`
8. **Telegram: Send Brief** - Notify subscribers (optional)

**Key Integration Point**:
```
HTTP POST to Dashboard
  URL: https://rippledash-ht3duhth.manus.space/api/trpc/n8n.publish
  Method: POST
  Headers: { "Content-Type": "application/json" }
  Body: {
    date: "June 10, 2026",
    dateSlug: "june-10-2026",
    sections: [
      {
        category: "Geopolitics",
        headline: "...",
        summary: "...",
        paragraphs: ["...", "..."],
        keyMetrics: [{ label: "...", value: "..." }],
        singaporeLens: "...",
        sources: [
          { outlet: "Reuters", title: "...", url: "https://...", date: "June 10" }
        ]
      },
      // ... 7 more sections
    ],
    telegraphUrl: "https://telegra.ph/...",
    dashboardUrl: "https://rippledash-ht3duhth.manus.space/brief/june-10-2026"
  }
```

---

## Part 3: Two Critical Gaps

### Gap 1: Source Link Accuracy

**Problem**: News source links in briefs are inaccurate or broken.

**Current Location**: `BriefCard.tsx` lines 207-231

**Root Cause**: Source links are manually entered in brief data (e.g., `may31Brief.ts`). No validation occurs:
- Links may be outdated (article moved/deleted)
- Links may be typos (copy-paste errors)
- Links may be paywalled or region-restricted

**Impact**: Users click broken links → frustration → reduced trust

**Proposed Solutions**:

1. **Validation on Ingest** (n8n)
   - When n8n extracts brief, validate each source URL
   - Test HTTP HEAD request to confirm link is reachable
   - Flag broken links and notify editor
   - Suggestion: Use n8n's HTTP node with `validateUrl` option

2. **Validation on Display** (Frontend)
   - Add link health check icon (✓ green, ✗ red, ? gray)
   - Show tooltip on hover: "Last checked: 2 hours ago"
   - Periodically re-check links in background (e.g., weekly)
   - Suggestion: Use a background job or periodic tRPC mutation

3. **Fallback Strategy**
   - If link is broken, show outlet name only (no link)
   - Provide "Report Broken Link" button
   - Log broken links for editor review

**Recommendation**: Implement validation on ingest (n8n) first. This prevents bad data from entering the system. Add display-side validation later if needed.

### Gap 2: Brief Dropdown UX for Archive

**Problem**: The brief selector dropdown doesn't scale well beyond 7 days. All briefs older than 7 days collapse into an "Archive" section with no drill-down interface.

**Current Location**: `WeeklyBriefSelector.tsx` lines 38-119

**Current Behavior**:
```
This Week (Jun 3-9)
  ✓ Jun 3
  ✓ Jun 4
  ✓ Jun 5
  ✓ Jun 6
  ✓ Jun 7

Last Week (May 27 - Jun 2)
  ✓ May 31
  ✓ Jun 1
  ✓ Jun 2

Archive
  ▼ May 2026 (22 briefs)
    ✓ May 30
    ✓ May 29
    ... (20 more)
```

**Problem**: Accessing a brief from 3 weeks ago requires:
1. Click "Archive"
2. Expand "May 2026"
3. Scroll through 22 items
4. Click the correct date

**User Request**: "Archive beyond 7 days points user to a calendar page where they can load past briefs"

**Proposed Solution**:

1. **Calendar Page** (New Route)
   - URL: `/calendar` or `/archive`
   - Display calendar grid (month view)
   - Highlight dates with available briefs
   - Click date → load brief
   - Navigate months with prev/next buttons
   - Search by date range or theme

2. **Updated Dropdown**
   - Keep "This Week" and "Last Week" visible
   - Replace "Archive" with "View Calendar" button/link
   - Clicking "View Calendar" navigates to `/calendar`

3. **Implementation Steps**
   - Create new component: `CalendarBriefArchive.tsx`
   - Create new route in `App.tsx`: `<Route path="/calendar" element={<CalendarBriefArchive />} />`
   - Update `WeeklyBriefSelector.tsx` to show "View Calendar" link
   - Fetch all briefs on calendar page and render month grid

**Recommendation**: Implement this after n8n integration is complete. It's a UX enhancement, not a blocker for the automated workflow.

---

## Part 4: Open Question — Trends Analysis

**Current State**: `TrendsDashboard.tsx` exists but its design is not finalized.

**User Request**: "I want to specify the exact layout/interaction model for the Trends view."

**Current Implementation**: Signals grouped by category with expandable cards showing:
- Date columns (May 31, Jun 1, Jun 2, etc.)
- Signal values for each date
- Story evolution (list of stories by date)
- Singapore Lens evolution timeline

**Questions for User**:

1. **Organization**: Should signals be grouped by:
   - Category (Geopolitics, Markets, Economics, Tech)? [Current]
   - Date (show all signals for a single date)? [Alternative]
   - Frequency (most consistent signals first)? [Alternative]

2. **Interaction**: When user clicks a signal/date cell, should it:
   - Expand inline to show full story details? [Current]
   - Open a modal/drawer? [Alternative]
   - Navigate to a detail page? [Alternative]

3. **Visualization**: Should the view include:
   - Charts (trend lines, heatmaps)? [Future]
   - Narrative synthesis (AI-generated summary)? [Future]
   - Comparison tools (compare two dates/signals)? [Future]

4. **Scope**: Should Trends show:
   - Current week only (filtered to latest 5-6 briefs)? [Current]
   - Custom date range (user-selectable)? [Alternative]
   - All available briefs? [Alternative]

**Next Step**: User provides design specification → Claude implements exact layout/interactions.

---

## Part 5: Implementation Checklist for Claude

### Phase 1: Validate Current State
- [ ] Review `BriefPageEnhanced.tsx` and confirm all hardcoded briefs are imported
- [ ] Test brief selection, display, and swipe navigation
- [ ] Verify TrendsDashboard renders signals correctly
- [ ] Check database schema in `drizzle/schema.ts` — confirm `n8nBriefs` table exists

### Phase 2: Address Gap 1 (Source Link Accuracy)
- [ ] Review `BriefCard.tsx` source rendering (lines 207-231)
- [ ] Propose validation strategy (on-ingest vs. on-display)
- [ ] If on-ingest: Update n8n workflow to validate URLs
- [ ] If on-display: Add link health check to BriefCard component
- [ ] Add "Report Broken Link" button with feedback mechanism

### Phase 3: Address Gap 2 (Brief Dropdown UX)
- [ ] Create `CalendarBriefArchive.tsx` component
- [ ] Add `/calendar` route to `App.tsx`
- [ ] Update `WeeklyBriefSelector.tsx` to show "View Calendar" link
- [ ] Implement month-grid calendar with date highlighting
- [ ] Test navigation and brief loading

### Phase 4: Clarify Trends Design
- [ ] Wait for user specification on layout/interactions
- [ ] Refactor `TrendsDashboard.tsx` based on user requirements
- [ ] Add new visualization/interaction patterns as specified
- [ ] Test with sample data (current 6 briefs)

### Phase 5: Prepare for n8n Integration
- [ ] Review `n8n-workflow-export.json` and validate structure
- [ ] Test n8n workflow with sample Telegraph URL
- [ ] Verify API endpoint `/api/trpc/n8n.publish` is accessible
- [ ] Test payload validation in `server/routers.ts`
- [ ] Document any required environment variables or secrets

### Phase 6: Retire Hardcoded Briefs
- [ ] Delete TypeScript brief files (may31Brief.ts, june1Brief.ts, etc.)
- [ ] Update `BriefPageEnhanced.tsx` to fetch from database only
- [ ] Ensure `n8n.getAll()` returns database records
- [ ] Test brief loading from empty database (graceful fallback)

### Phase 7: Testing & Deployment
- [ ] Run full test suite: `pnpm test`
- [ ] Manual testing: All tabs, interactions, edge cases
- [ ] Performance testing: Load time with 100+ briefs
- [ ] Deploy to production
- [ ] Monitor error logs and user feedback

---

## Part 6: Key Files Reference

| File | Purpose | Status |
|------|---------|--------|
| `client/src/pages/BriefPageEnhanced.tsx` | Main brief page orchestrator | ✅ Active |
| `client/src/components/BriefCard.tsx` | Story card display (GAP 1 here) | ✅ Active |
| `client/src/components/WeeklyBriefSelector.tsx` | Brief picker dropdown (GAP 2 here) | ✅ Active |
| `client/src/components/TrendsDashboard.tsx` | Signal trends view (OPEN question) | ✅ Active |
| `client/src/components/SwipeDemo.tsx` | Story navigation | ✅ Active |
| `client/src/lib/briefParser.ts` | Parse brief JSON | ✅ Active |
| `client/src/lib/weekUtils.ts` | Week grouping logic | ✅ Active |
| `client/src/lib/signalMapper.ts` | Extract signal threads | ✅ Active |
| `client/src/lib/storyMapper.ts` | Map stories to signals | ✅ Active |
| `client/src/lib/singaporeLensMapper.ts` | Singapore Lens synthesis | ✅ Active |
| `server/routers.ts` | tRPC API procedures | ✅ Active |
| `server/db.ts` | Database helpers | ✅ Active |
| `drizzle/schema.ts` | Database schema | ✅ Active |
| `n8n-workflow-export.json` | n8n workflow definition | 📋 Ready |
| `N8N_HYBRID_INTEGRATION_GUIDE.md` | n8n setup guide | 📋 Reference |
| `DATABASE_FUNCTIONALITY.md` | DB architecture guide | 📋 Reference |
| `MVP1_SPECIFICATION.md` | Original MVP spec | 📋 Reference |

---

## Part 7: Environment & Secrets

### Required Secrets (Already Configured)

- `VITE_APP_ID` - Manus OAuth app ID
- `VITE_OAUTH_PORTAL_URL` - Manus login portal
- `JWT_SECRET` - Session signing key
- `DATABASE_URL` - MySQL connection string
- `BUILT_IN_FORGE_API_KEY` - Manus LLM API key
- `VITE_FRONTEND_FORGE_API_KEY` - Frontend LLM access

### For n8n Integration (To Be Added)

- `N8N_WEBHOOK_URL` - Webhook URL for n8n to POST briefs
- `N8N_API_KEY` - n8n API key (if using n8n cloud)
- `TELEGRAPH_API_TOKEN` - Telegraph.ph API token (optional)

---

## Part 8: Success Criteria

### Current State (Manual)
- ✅ 6 briefs available (May 31 - Jun 5, 2026)
- ✅ Brief selection and display working
- ✅ Swipe navigation working
- ✅ Trends dashboard rendering signals
- ✅ Singapore Lens synthesis working
- ✅ All tests passing (64 tests)

### After n8n Integration
- [ ] n8n workflow publishes briefs to database
- [ ] Frontend fetches briefs from database (not hardcoded)
- [ ] New briefs appear in dashboard within 1 minute of publication
- [ ] Source links validated (no broken links)
- [ ] Archive dropdown streamlined with calendar page
- [ ] Trends design finalized per user spec
- [ ] All tests passing
- [ ] Zero downtime during transition

---

## Part 9: Contact & Handoff

**Current Owner**: Manus Agent  
**Handoff To**: Claude Code  
**Date**: June 9, 2026

**Key Decisions Pending User Input**:
1. Source link validation strategy (on-ingest vs. on-display)
2. Brief dropdown archive UX (calendar page design)
3. Trends analysis layout and interactions

**Next Steps**:
1. User reviews this document and provides feedback
2. Claude Code implements gaps 1 & 2 + clarifies Trends design with user
3. After user approval, Claude Code prepares for n8n integration
4. Manus Agent or Claude Code deploys and monitors n8n workflow

---

**Document Version**: 1.0  
**Last Updated**: June 9, 2026  
**Status**: Ready for Handoff
