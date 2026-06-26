# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# The Daily Ripple — project specifics

Project-specific conventions that extend the four principles above.

## Stack & local dev

- Frontend: React 19 + Vite + Tailwind 4 + tRPC client (port 3000, proxies `/api` → 3001).
- Backend: Express + tRPC 11 + Drizzle ORM + **PostgreSQL** (`DATABASE_URL`). Run with `PORT=3001 tsx watch server/index.ts`.
- Prefer the `preview_*` tools for running the dev server and verifying UI — not ad-hoc `npm`/browser commands.

## Before every commit

- Run `npx tsc --noEmit`, `npx vitest run` (keep the suite green), and `npx vite build` — all must pass.
- Update `README.md` **and its Changelog** for every user-facing change (newest entry first, dated).
- End commit messages with the `Co-Authored-By: Claude ...` line. Work on the default branch is fine for this repo's solo flow; push only when asked.

## Verifying a change ("Goal-Driven Execution", adapted)

- **Logic / data changes** → write or extend a test, or assert the behaviour directly.
- **Visual / UI changes** (bento, cards, icons, layout) → verify in the preview and share a screenshot; don't add low-value tests just to satisfy the principle.

## Brief data lives in Postgres, not the repo

- Bundled briefs (`briefs-json-export/*.ts`, through ~20 Jun 2026) are upserted on every boot via `server/seed.ts`.
- Later briefs are **published at runtime by n8n** (`POST /api/publish`) and exist **only in the production database** — they cannot be fixed by editing repo files, and the local DB usually won't have them.
- One-off market-figure corrections go through the guarded `MANUAL_METRIC_FIXES` patch in `server/seed.ts` (keyed off the known-wrong value so it applies once and never clobbers later data). Delete that block once trustworthy market data (Alpha Vantage) flows in.

## Rendering rules over per-brief data fixes

- Prefer fixing rendering in the components so every current and future brief benefits (e.g. the Singapore Lens falls back to `paragraphs[2]`; the metric strip hides valueless `—` boxes) rather than hand-patching individual briefs.
