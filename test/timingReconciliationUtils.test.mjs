import { describe, it, expect } from "vitest";
import { findDuplicateGroups } from "../src/utils/timingReconciliationUtils.js";

describe("findDuplicateGroups", () => {
  it("groups timings within threshold from different devices", () => {
    const base = new Date("2026-01-01T10:00:00.000Z");
    const timings = [
      {
        id: "a",
        timestamp: base.toISOString(),
        device_id: "device-a",
        status: "pending",
      },
      {
        id: "b",
        timestamp: new Date(base.getTime() + 120).toISOString(),
        device_id: "device-b",
        status: "pending",
      },
      {
        id: "c",
        timestamp: new Date(base.getTime() + 5000).toISOString(),
        device_id: "device-a",
        status: "pending",
      },
    ];

    const groups = findDuplicateGroups(timings, 500);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("ignores single timings", () => {
    const groups = findDuplicateGroups([
      {
        id: "a",
        timestamp: new Date().toISOString(),
        device_id: "x",
        status: "pending",
      },
    ]);
    expect(groups).toHaveLength(0);
  });
});
