import { describe, it, expect } from "vitest";
import { calculateSegmentMetrics } from "../src/utils/segmentCalculator.js";

describe("calculateSegmentMetrics", () => {
  it("returns null metrics when crewId is missing", async () => {
    const result = await calculateSegmentMetrics("tp-2", null, "event-1", 120000);
    expect(result.segment_time_ms).toBe(null);
    expect(result.speed_mps).toBe(null);
  });
});
