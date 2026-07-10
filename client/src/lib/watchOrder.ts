/**
 * Pure ordering helpers for the re-orderable Active Watches list. The order the
 * reader arranges is persisted (localStorage, no accounts); these functions merge
 * that saved order with the live set of watch ids and move items within it. Pure
 * so the reorder logic is unit-tested independently of the drag wiring.
 */

/**
 * Merge a saved id order with the current live ids: keep the saved arrangement
 * (dropping ids that no longer exist), then append any new ids not yet seen —
 * preserving the order they arrive in (newest-first from the query). So a reader's
 * manual arrangement survives, and freshly-surfaced watches land at the end.
 */
export function mergeWatchOrder(saved: number[], currentIds: number[]): number[] {
  const live = new Set(currentIds);
  const seen = new Set<number>();
  const kept = saved.filter((id) => live.has(id) && !seen.has(id) && (seen.add(id), true));
  const appended = currentIds.filter((id) => !seen.has(id));
  return [...kept, ...appended];
}

/** Move `srcId` to sit at `targetId`'s position (no-op if either is missing). */
export function moveBefore(order: number[], srcId: number, targetId: number): number[] {
  if (srcId === targetId || !order.includes(srcId) || !order.includes(targetId)) return order;
  const without = order.filter((id) => id !== srcId);
  const ti = without.indexOf(targetId);
  return [...without.slice(0, ti), srcId, ...without.slice(ti)];
}

/** Nudge `id` one place up (dir -1) or down (dir +1); no-op at the ends. */
export function moveByStep(order: number[], id: number, dir: -1 | 1): number[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
