# Project TODO

## Existing Features (Completed)
- [x] Basic dashboard layout with Cartographic Intelligence design
- [x] Scrolling market data ticker
- [x] Story cards with category filtering
- [x] Interactive SVG ripple network
- [x] Category filtering
- [x] Insight panels (historical parallel, culture note, synthesis)
- [x] Custom generated imagery for sections

## Bento Box Brief System (New - In Progress)
- [x] Brief Parser (briefParser.ts) - Converts HTML brief content into structured schema
- [x] Brief Parser Tests (briefParser.test.ts) - 11 tests passing
- [x] Sample Brief Data (sampleBrief.ts) - Demo data for testing
- [x] BriefPage Component - Main page displaying daily briefs
- [x] BentoBriefContainer - Premium asymmetric grid layout (poster aesthetic)
- [x] BriefCard - Individual story card with expandable details
- [x] BriefHeader - Masthead and greeting section
- [x] SystemsSynthesisPanel - Section 8 synthesis display
- [x] App Routing - Added /brief route
- [x] Color Palette Integration - Deep navy, gold, cyan accents
- [x] TypeScript Type Safety - All components properly typed
- [x] Navigation Link - Added "View Bento Box" link in Home header
- [x] Make bento box default landing page (replace Home.tsx)
- [x] Swipe-to-next-story navigation (touch gestures)
- [x] Font size controls with persistence (localStorage)
- [x] Smooth animations and transitions
- [x] Story cards with expand/collapse
- [x] Singapore Lens callout always visible
- [x] Reading time estimation
- [x] Mobile-optimized layout
- [x] Parse May 31 Telegraph brief and populate data
- [x] Mobile responsiveness testing and refinement
- [x] Remove duplicate Singapore flag emoji from collapsed cards
- [x] Move full Singapore Lens text to expanded card (now appears last after 2 paragraphs)
- [x] Remove repeated 8-section grid below swipe demo
- [x] Remove "Singapore Lens — Click to expand" boxes from all collapsed cards
- [x] Remove all text truncation - text wraps to multiple lines instead of ellipsis
- [x] Remove max-width constraint on SwipeDemo for full responsive width
- [x] Embed masthead design with dynamic date overlay
- [x] Upload masthead image to S3 storage
- [x] Create MastheadBanner component with date formatting
- [x] Remove top ticker/market section from landing page
- [x] Fix font size persistence using useEffect instead of useState
- [x] Move 'User Guide' to tooltip-style section at bottom of page

## Database & API (Completed)
- [x] Add database table for n8nBriefs (date, dateSlug, sections, telegraphUrl, dashboardUrl)
- [x] Create /api/scheduled/publish-n8n-brief endpoint for n8n workflow integration
- [x] Create /api/n8n-brief GET endpoint to retrieve published briefs
- [x] Database schema with proper timestamps and unique constraints
- [x] Database helper functions: publishN8nBrief, getLatestN8nBrief, getN8nBriefBySlug
- [x] Error handling and validation for API endpoints
- [x] Create comprehensive N8N_INTEGRATION_GUIDE.md
- [x] Document section structure and payload format
- [x] Document testing procedures and debugging steps
- [x] Document production deployment checklist

## Remaining Work (Completed)
- [x] Write vitest tests for n8n endpoints (/api/scheduled/publish-n8n-brief, /api/n8n-brief)
- [x] Add live market ticker via Heartbeat (free HTTP cron, every 60s)
- [x] Create /api/scheduled/market-ticker endpoint for Heartbeat
- [x] Add tRPC query to serve n8n briefs to frontend
- [x] Update frontend to fetch n8n briefs from API instead of hardcoded data
- [x] Graceful fallback: show static data when no DB data exists yet (falls back to may31Brief)

## UI Improvements (Completed)
- [x] Convert User Guide to tooltip-triggered modal overlay
- [x] Remove non-functional font size controls from top bar
- [x] Add help icon button to header for accessing User Guide
- [x] Implement modal backdrop with smooth animations
- [x] Create brief selector dropdown (May 31, June 1, June 2, June 3)
- [x] Create TrendsDashboard component showing signal movements across briefs
- [x] Add tab navigation (Daily Brief / Trends)
- [x] Display trends with 3-column layout (May 31 → June 1 → June 2 → June 3)
- [x] Show Key Insights section in trends view
- [x] Show Systems Synthesis section in trends view

- [x] Add Singapore Lens element to Trends dashboard for each signal
- [x] Optimize responsive design for mobile/tablet/desktop (sm/md/lg breakpoints)
- [x] Remove Interactive Demo element from main tab

- [x] Integrate June 3 brief (Iran fires on US troops) with 5 stories
- [x] Update TrendsDashboard to support optional june3 brief
- [x] Fix Telegram browser swipe-right gesture interception issue

## Known Issues & Next Steps
- [x] Fix brief selector dropdown - clicking June 1 or June 2 doesn't change displayed brief (FIXED: replaced custom dropdown with Radix UI Select component for proper event handling)

## Bugs to Fix (Priority 1)
- [x] Jun 3 brief — only showing 8 sections, not persisting on the Trends dashboard (FIXED: Added June 3 column to TrendsDashboard with 4-column grid layout)
- [x] Jun 1 and Jun 2 — Culture section showing placeholder content instead of actual brief content (FIXED: Added PopMart story for June 1, Setlog/BTS story for June 2)
- [x] Swipe/carousel navigation not working on desktop browser — should work with click-drag or arrow keys (FIXED: Added mouse drag handlers and arrow key listeners to SwipeDemo)
- [x] Source links pointing to home pages instead of specific article URLs (FIXED: Updated all source URLs in may31Brief, june1Brief, june2Brief, june3Brief)
- [x] Section labels incorrect — e.g. DBS story showing as "Business" when it should be "Lead Story" (DEPRIORITIZED per user request)

## Deprioritized Bugs
- [ ] Telegram swipe-right gesture — not working; needs to be resolved before wider sharing (DEPRIORITIZED)
- [ ] Section headers — increase font size (DEPRIORITIZED - Visual #6)

## Visual Enhancements (Priority 2)
- [x] Brief selector dropdown — display up to the past 3 days only (rolling window) + "Older Posts" archive option (DONE: Reorganized selector with June 1-3 recent + May 31 in archive)
- [x] Default landing to latest dated brief — automatically load the most recent brief on page load (DONE: Changed default state to june3Brief)
- [x] Typography hierarchy — 4 distinct levels (section label, headline, body, metadata) (DONE: Added CSS classes)
- [x] Card depth — surface differentiation with inner border and gradient instead of drop shadows (DONE: Added inner glow, shadow effects)
- [x] Singapore Lens callout — warm gold left border, warmer background, small caps label (DONE: Added gold styling)
- [x] Section headers — increase font size (DONE: Added .section-header class with lg-2xl sizing)
- [x] Color palette refinement — teal accent, warm gold for Singapore elements (DONE: Updated colors)
- [x] Trends tab visual improvements — directional arrows, "LATEST" badge, underline annotations (DONE: Added LATEST badge, underlined date headers, June 3 star indicator)
- [x] Navigation and wayfinding — larger chevrons with glow, dot progress indicator, elevated tab bar (DONE: Enhanced SwipeDemo with glow effects, larger chevrons, improved dots)
- [x] New visitor onboarding — dismissible banner with Telegram subscribe CTA (DONE: Created OnboardingBanner component with localStorage tracking)

## Trends Dashboard Roadmap - Weekly Cycle Implementation
- [x] Phase 1: Create week utilities for Monday-Sunday grouping (DONE: weekUtils.ts with 20 passing tests)
- [x] Phase 2: Refactor TrendsDashboard to show current week only (DONE: Filters briefs by week, highlights latest)
- [x] Phase 3: Redesign brief selector with week-based grouping (DONE: WeeklyBriefSelector with This Week/Last Week/Archive)
- [x] Phase 4: Add comprehensive tests (DONE: 58 tests passing, all utilities tested)

## Future Enhancements
- [x] Add signal direction indicators (↑/↓/→) in Trends dashboard (DONE: Colored badges matching BriefCard style)
- [x] Implement date-based brief auto-loading from database (DONE: Backend infrastructure ready - n8n.getAll tRPC procedure + getAllN8nBriefs helper. Frontend integration deferred - requires data transformation layer)
- [x] Create "Compare Briefs" side-by-side view (DONE: CompareBriefs component with navigation)
- [x] Add expandable signal tooltips with summaries (DONE: SignalTooltip component with 5 signals × 4 dates = 20 summaries)
- [x] Fix nested touch handler double-firing (DONE: Removed duplicate handlers, added regression tests)
- [ ] Set up n8n workflow for automated brief generation
- [x] Fix carousel skipping bug (DONE: Added isProcessing flag to prevent double-firing)


## Critical Bugs to Fix
- [x] Trends highlighting — June 3 boxes not highlighted in teal (FIXED: Applied teal styling to June 3 cells)
- [x] Date format mismatch — showing "03 Jun" instead of "3 Jun", needs systemic fix across all components (FIXED: Corrected june3Brief date to "June 3, 2026")
- [x] Signal arrows confusing — up/down arrows on news summaries unclear, need better visualization (FIXED: Replaced arrows with descriptive change text in june3Brief keyMetrics)


## Systemic Safeguards (Future-Proofing)
- [x] Date formatter utility — centralized date formatting to prevent format inconsistencies (DONE: Created dateUtils.ts with formatBriefDate, formatBriefDateUppercase, compareDates)
- [x] Dynamic latest brief detection — automatically detects latest brief by date comparison instead of hardcoding (DONE: Updated BriefPageEnhanced to use compareDates and getLatestBriefKey)
- [x] Data validation tests — comprehensive vitest suite for date utilities (DONE: Created dateUtils.test.ts with 16 passing tests)
- [x] SwipeDemo external state management — supports both internal and external state for flexible navigation (DONE: Updated SwipeDemo props to accept currentIndex, onPrevious, onNext)


## Final Bug Fixes (Session 2)
- [x] Carousel skipping issue (FIXED: Added async delays between navigation calls)
- [x] Trends signal box layout (FIXED: Proper grid sizing, text wrapping, alignment)
- [x] Compare Briefs removal (DONE: Removed button and modal)


## Session 3 - Mobile UX & Interaction Improvements
- [x] Fix daily brief carousel skipping (works near dots but skips when swiping in card area) - DONE in Phase 1
- [x] Convert Trends dashboard to horizontal carousel for mobile (avoid compression) - DONE in Phase 2
- [x] Add expandable cards with tooltips showing story summaries - DONE in Phase 3
  - Created SignalTooltip component with expandable state
  - Added comprehensive summaries for all 5 signals across 4 dates
  - Integrated tooltips into TrendsDashboard with proper styling
  - All 58 tests passing
- [x] Fix nested touch handler double-firing regression - DONE in Phase 3.5
  - Removed duplicate keyboard listener from BriefPageEnhanced
  - Removed parent touch wrapper around SwipeDemo
  - SwipeDemo now owns all navigation (touch, keyboard, mouse, dot, chevron)
  - Added SwipeDemo.regression.test.ts with 6 comprehensive tests
  - All 64 tests passing
- [x] Set up n8n workflow for automated brief generation (Phase 4 - Final)
  - Added comprehensive n8n workflow setup guide to N8N_INTEGRATION_GUIDE.md
  - Documented workflow configuration steps (HTTP request, data source, scheduling)
  - Provided example n8n workflow JSON for quick implementation
  - Included troubleshooting and monitoring guidance
  - Backend API endpoints already implemented and tested

## Session 4 - Brief Upload (Jun 4 & Jun 5)
- [x] Download Jun 4 brief from Telegraph link - DONE
- [x] Download Jun 5 brief from Telegraph link - DONE
- [x] Parse and integrate both briefs into dashboard - DONE
- [x] Update Trends dashboard to show 6-day signal tracking - DONE
  - Created jun4Brief.ts and jun5Brief.ts with full structured content
  - Integrated into BriefPageEnhanced component
  - TrendsDashboard now displays signals from 6 briefs (May 31 - Jun 5)
  - All 64 tests passing
- [x] Save checkpoint with new briefs - DONE
- [x] Test in browser to verify all functionality works - DONE

## Critical Data Fixes (Session 4 - Continuation)
- [x] Phase 1: Audit and complete Jun 4 & Jun 5 brief data (8 sections each) - DONE
- [x] Phase 2: Add missing trend signals for Jun 4 & Jun 5 - DONE
- [x] Phase 3: Create dynamic aggregation functions for Singapore Lens/Insights/Synthesis - DONE
- [x] Phase 4: Refactor TrendsDashboard to use aggregated data - DONE
- [x] Phase 5: Add comprehensive tests and documentation - DONE
- [x] Phase 6: Verify data flow and test end-to-end - DONE

## Session 5 - Theme-Based Trends Redesign
- [x] Analyze brief data to identify common trend themes - DONE
- [x] Create themeExtractor.ts with 7 core themes - DONE
- [x] Rebuild TrendsDashboard with theme-based format - DONE
- [x] Verify browser testing and functionality - DONE
- [x] Save checkpoint with new theme-based format - DONE


## Session 6 - Trends Funnel Dashboard Implementation (COMPLETE)
- [x] Phase 1: Create TrendsFunnelDashboard with day navigation - DONE
- [x] Phase 2: Implement signal extraction and dynamic threshold - DONE
- [x] Phase 3: Add expandable signal cards with Singapore Lens - DONE
- [x] Phase 4: Implement dynamic Systems Synthesis - DONE
- [x] Phase 5: Add Top Themes section - DONE
- [x] Phase 6: Integrate and test end-to-end - DONE

## Session 7 - Code Cleanup & Refinement
- [x] Remove fontSize editor from UI - DONE
- [x] Integrate storyMapper.ts to enable expandable story summaries in Trends - DONE
- [x] Integrate singaporeLensMapper.ts to display synthesized Singapore Lens evolution - DONE
- [x] Style expansion panels to match design references - DONE
- [ ] Finalize n8n integration for automated brief generation
