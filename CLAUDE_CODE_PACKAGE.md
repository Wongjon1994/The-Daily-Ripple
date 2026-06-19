# Claude Code: Complete Package Guide

This document lists all files and resources Claude Code needs to fully understand and replicate the Ripple Dashboard UI/UX in its current state, plus ideate improvements on the two gaps and Trends design.

---

## Package Contents

### 1. Core Documentation (START HERE)

| File | Purpose |
|------|---------|
| `CLAUDE_HANDOFF_TRANSITION.md` | **Main handoff document** - Architecture, workflows, gaps, implementation roadmap |
| `DATABASE_FUNCTIONALITY.md` | Brief storage architecture and data flow |
| `MVP1_SPECIFICATION.md` | Original product vision and scope |
| `N8N_HYBRID_INTEGRATION_GUIDE.md` | n8n workflow integration strategy |
| `HEARTBEAT_SETUP.md` | Cron job and automation setup |
| `README.md` | Project setup and running instructions |

**Start with**: `CLAUDE_HANDOFF_TRANSITION.md` → then reference others as needed

---

### 2. Key Component Source Code

#### Critical UI Components (Must Read)

| File | Purpose | Lines | Why It Matters |
|------|---------|-------|----------------|
| `client/src/components/BriefCard.tsx` | Individual story card display | ~250 | **GAP 1 here** - Source links rendered at lines 207-231 |
| `client/src/components/WeeklyBriefSelector.tsx` | Brief dropdown selector | ~200 | **GAP 2 here** - Archive UX at lines 38-119 |
| `client/src/components/TrendsDashboard.tsx` | Signal trends view | ~300 | **OPEN question** - Design to be specified |
| `client/src/components/SwipeDemo.tsx` | Story navigation (swipe/keyboard) | ~200 | Core interaction pattern |
| `client/src/components/MastheadBanner.tsx` | Header with logo and date | ~100 | Visual identity |

#### Supporting Components

| File | Purpose |
|------|---------|
| `client/src/components/DashboardLayout.tsx` | Layout wrapper (if used) |
| `client/src/components/BentoBriefContainer.tsx` | Legacy container (now unused) |
| `client/src/components/AIChatBox.tsx` | Chat interface (future feature) |

#### Page Components

| File | Purpose | Lines |
|------|---------|-------|
| `client/src/pages/BriefPageEnhanced.tsx` | Main brief display page | ~150 |
| `client/src/pages/Home.tsx` | Landing page | ~50 |

---

### 3. Design System & Styling

| File | Purpose | Key Info |
|------|---------|----------|
| `client/src/index.css` | **Global styles + design tokens** | Colors, typography, spacing, shadows, animations |
| `components.json` | shadcn/ui configuration | Component variants and customizations |
| `client/index.html` | HTML template | Font imports (Google Fonts), meta tags |
| `tailwind.config.ts` | Tailwind configuration | Color palette, breakpoints, plugins |

**Critical**: `client/src/index.css` contains all design tokens (colors, spacing, shadows) that define the visual style.

---

### 4. Data & Logic Utilities

| File | Purpose | Key Functions |
|------|---------|----------------|
| `client/src/lib/briefParser.ts` | Parse brief JSON to DailyBrief type | `parseBriefData()`, type definitions |
| `client/src/lib/weekUtils.ts` | Group briefs by week | `groupBriefsByWeek()`, `getWeekKey()` |
| `client/src/lib/dateUtils.ts` | Date comparison & formatting | `formatBriefDate()`, `compareDates()` |
| `client/src/lib/signalMapper.ts` | Extract signal threads | `extractSignalThreads()` |
| `client/src/lib/storyMapper.ts` | Map stories to signals by date | `mapStoriesToSignals()` |
| `client/src/lib/singaporeLensMapper.ts` | Synthesize Singapore Lens evolution | `synthesizeSingaporeLens()` |
| `client/src/lib/trpc.ts` | tRPC client setup | API client initialization |

---

### 5. Hardcoded Brief Data (Current State)

These files contain sample briefs used in the current manual workflow:

| File | Date | Purpose |
|------|------|---------|
| `client/src/lib/may31Brief.ts` | May 31, 2026 | Sample brief data |
| `client/src/lib/june1Brief.ts` | June 1, 2026 | Sample brief data |
| `client/src/lib/june2Brief.ts` | June 2, 2026 | Sample brief data |
| `client/src/lib/june3Brief.ts` | June 3, 2026 | Sample brief data |
| `client/src/lib/june4Brief.ts` | June 4, 2026 | Sample brief data |
| `client/src/lib/june5Brief.ts` | June 5, 2026 | Sample brief data |

**Note**: These will be replaced by database-driven briefs after n8n integration.

---

### 6. Backend Source Code

| File | Purpose | Key Exports |
|------|---------|-------------|
| `server/routers.ts` | tRPC API procedures | `n8n.*`, `auth.*`, `system.*` |
| `server/db.ts` | Database query helpers | `publishN8nBrief()`, `getAllN8nBriefs()`, etc. |
| `drizzle/schema.ts` | Database schema definitions | `n8nBriefs`, `briefSignals`, `briefThemes` |
| `server/_core/context.ts` | Auth context builder | User context injection |
| `server/_core/oauth.ts` | Manus OAuth handler | OAuth flow |
| `server/_core/llm.ts` | Claude API wrapper | LLM invocation |
| `server/_core/notification.ts` | Owner notification | `notifyOwner()` |
| `server/storage.ts` | S3 file storage | `storagePut()`, `storageGet()` |

---

### 7. Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `pnpm-lock.yaml` | Locked dependency versions |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite build configuration |
| `drizzle.config.ts` | Drizzle ORM configuration |
| `n8n-workflow-export.json` | n8n workflow definition |

---

### 8. Visual References (Screenshots)

You'll need to capture screenshots of the current dashboard:

**Required Screenshots**:
1. **Daily Brief Tab** - Full page view
   - Mastheadwith logo and date selector
   - Brief card (collapsed state)
   - Brief card (expanded state with full story)
   - Source links section
   - Singapore Lens section

2. **Trends Tab** - Full page view
   - Signal categories (Geopolitics, Markets, etc.)
   - Expandable signal cards
   - Date columns with signal values
   - Story evolution section
   - Singapore Lens evolution section

3. **Brief Selector Dropdown**
   - "This Week" section
   - "Last Week" section
   - "Archive" section (collapsed and expanded)
   - Mobile view (if different)

4. **Responsive Breakpoints**
   - Desktop (1920px)
   - Tablet (768px)
   - Mobile (375px)

5. **Interaction States**
   - Hover states on cards
   - Expanded/collapsed states
   - Loading states
   - Empty states

---

## How to Use This Package

### For Claude Code (Replication + Ideation)

**Step 1: Understanding**
1. Read `CLAUDE_HANDOFF_TRANSITION.md` (30 min)
2. Skim `DATABASE_FUNCTIONALITY.md` and `MVP1_SPECIFICATION.md` (15 min)
3. Review component file list above (5 min)

**Step 2: Deep Dive**
1. Read `client/src/components/BriefCard.tsx` (understand story display)
2. Read `client/src/components/WeeklyBriefSelector.tsx` (understand brief picker)
3. Read `client/src/components/TrendsDashboard.tsx` (understand trends view)
4. Read `client/src/index.css` (understand design tokens)

**Step 3: Data Flow**
1. Read `client/src/pages/BriefPageEnhanced.tsx` (understand orchestration)
2. Read `client/src/lib/briefParser.ts` (understand data types)
3. Read `server/routers.ts` (understand API contract)

**Step 4: Ideation**
1. Review the two gaps in `CLAUDE_HANDOFF_TRANSITION.md` Part 3
2. Review the Trends open questions in Part 4
3. Propose solutions and design improvements

### For You (Sharing with Claude)

**Minimum Package** (for ideation only):
- `CLAUDE_HANDOFF_TRANSITION.md`
- `client/src/components/BriefCard.tsx`
- `client/src/components/WeeklyBriefSelector.tsx`
- `client/src/components/TrendsDashboard.tsx`
- `client/src/index.css`
- Screenshots of current UI

**Complete Package** (for full replication + ideation):
- All files listed in sections 1-7 above
- All screenshots from section 8
- The entire `client/src` directory
- The entire `server` directory

---

## File Reading Order (Recommended)

1. **Start**: `CLAUDE_HANDOFF_TRANSITION.md` (main context)
2. **Design**: `client/src/index.css` (visual language)
3. **UI Components**: 
   - `BriefCard.tsx` (story display)
   - `WeeklyBriefSelector.tsx` (brief picker)
   - `TrendsDashboard.tsx` (trends view)
4. **Pages**: `BriefPageEnhanced.tsx` (orchestration)
5. **Logic**: `briefParser.ts`, `weekUtils.ts`, `dateUtils.ts`
6. **Backend**: `server/routers.ts`, `server/db.ts`
7. **Data**: Sample brief files (may31Brief.ts, etc.)
8. **Reference**: Other docs as needed

---

## Key Design Tokens (From index.css)

These define the visual identity—Claude should reference these when proposing UI changes:

- **Colors**: Primary (cyan), Secondary (gold), Backgrounds (dark navy)
- **Typography**: Font family, sizes, weights, line heights
- **Spacing**: Margin and padding scale
- **Shadows**: Elevation system
- **Animations**: Transition timings and easing
- **Borders**: Radius and colors

---

## Questions for Claude

Once Claude has reviewed everything, guide the conversation with:

1. **Gap 1 - Source Links**: How should we validate and display source link accuracy?
2. **Gap 2 - Archive UX**: How should we redesign the brief selector for 100+ briefs?
3. **Trends Design**: What's the ideal layout and interaction model for signal analysis?

---

## Next Steps

1. Download all files from the project
2. Share with Claude Code
3. Claude reviews and proposes solutions
4. You provide feedback and iterate
5. Claude implements approved designs

---

**Document Version**: 1.0  
**Created**: June 9, 2026  
**Status**: Ready for Claude Code Handoff
