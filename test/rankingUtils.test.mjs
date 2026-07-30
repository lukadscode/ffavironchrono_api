import { describe, it, expect } from "vitest";
import { assignDeadHeatPositions } from "../src/utils/rankingUtils.js";

describe("assignDeadHeatPositions", () => {
  it("assigns shared positions for identical times", () => {
    const items = [
      { id: "a", t: 100000 },
      { id: "b", t: 100000 },
      { id: "c", t: 105000 },
      { id: "d", t: 105000 },
      { id: "e", t: 110000 },
    ];

    const ranked = assignDeadHeatPositions(items, (x) => x.t);
    expect(ranked.map((r) => r.position)).toEqual([1, 1, 3, 3, 5]);
  });

  it("returns null position when time is missing", () => {
    const items = [{ id: "a", t: null }, { id: "b", t: 90000 }];
    const ranked = assignDeadHeatPositions(items, (x) => x.t);
    expect(ranked[0].position).toBe(null);
    expect(ranked[1].position).toBe(1);
  });
});
