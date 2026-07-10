import { describe, it, expect } from "vitest";
import { mergeWatchOrder, moveBefore, moveByStep } from "./watchOrder";

describe("mergeWatchOrder", () => {
  it("keeps the saved arrangement and appends new ids at the end", () => {
    expect(mergeWatchOrder([3, 1, 2], [1, 2, 3, 4, 5])).toEqual([3, 1, 2, 4, 5]);
  });

  it("drops saved ids that no longer exist", () => {
    expect(mergeWatchOrder([9, 3, 1], [1, 2, 3])).toEqual([3, 1, 2]);
  });

  it("falls back to current order when nothing is saved", () => {
    expect(mergeWatchOrder([], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("dedupes a corrupt saved order", () => {
    expect(mergeWatchOrder([1, 1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe("moveBefore", () => {
  it("moves an item down to just before a later target", () => {
    expect(moveBefore([1, 2, 3, 4], 1, 3)).toEqual([2, 1, 3, 4]);
  });

  it("moves an item up to an earlier target's position", () => {
    expect(moveBefore([1, 2, 3, 4], 4, 2)).toEqual([1, 4, 2, 3]);
  });

  it("is a no-op for the same id or a missing id", () => {
    expect(moveBefore([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
    expect(moveBefore([1, 2, 3], 9, 2)).toEqual([1, 2, 3]);
  });
});

describe("moveByStep", () => {
  it("moves an item up one place", () => {
    expect(moveByStep([1, 2, 3, 4], 3, -1)).toEqual([1, 3, 2, 4]);
  });

  it("moves an item down one place", () => {
    expect(moveByStep([1, 2, 3, 4], 2, 1)).toEqual([1, 3, 2, 4]);
  });

  it("is a no-op at the ends and for a missing id", () => {
    expect(moveByStep([1, 2, 3], 1, -1)).toEqual([1, 2, 3]);
    expect(moveByStep([1, 2, 3], 3, 1)).toEqual([1, 2, 3]);
    expect(moveByStep([1, 2, 3], 9, 1)).toEqual([1, 2, 3]);
  });
});
