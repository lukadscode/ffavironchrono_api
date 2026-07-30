import { describe, it, expect } from "vitest";
import {
  parseLifContent,
  parseFinishLynxTime,
  parseTimeOfDayMs,
  mergeTimeWithDate,
  parseCompetitorStatus,
} from "../src/utils/finishLynxParser.js";

const SAMPLE_LIF = `;Finish Lynx sample
161,2,1,Varsity Girls 3200m,,,,,,,17:20:10.2457
1,616,1,Asay,Brycen,SALE,11:02.661,,11:02.661,,,17:20:10.246,2512,,,11:02.661,,
2,615,2,Avery,Braden,AMER,11:08.371,,0:05.710,,,17:20:10.246,2512,,,,,
DNS,737,3,Johnson,Edward,PROV,,,,,,17:20:10.246,2512,,,,,
`;

describe("parseFinishLynxTime", () => {
  it("parses mm:ss.mmm", () => {
    expect(parseFinishLynxTime("11:02.661")).toBe(662661);
  });

  it("parses plain seconds", () => {
    expect(parseFinishLynxTime("83.456")).toBe(83456);
  });

  it("parses hh:mm:ss.mmm", () => {
    expect(parseFinishLynxTime("1:02:03.5")).toBe(3723500);
  });
});

describe("parseTimeOfDayMs", () => {
  it("parses hh:mm:ss.ms", () => {
    expect(parseTimeOfDayMs("17:20:10.2457")).toBe(62410246);
  });
});

describe("parseCompetitorStatus", () => {
  it("maps DNS to dns", () => {
    expect(parseCompetitorStatus("DNS")).toBe("dns");
  });
});

describe("parseLifContent", () => {
  it("parses event row and competitors", () => {
    const parsed = parseLifContent(SAMPLE_LIF);

    expect(parsed.event.heatNumber).toBe(1);
    expect(parsed.event.eventName).toContain("Varsity Girls");
    expect(parsed.event.startTimeRaw).toBe("17:20:10.2457");

    expect(parsed.competitors).toHaveLength(3);
    expect(parsed.competitors[0].lane).toBe(1);
    expect(parsed.competitors[0].timeMs).toBe(662661);
    expect(parsed.competitors[2].status).toBe("dns");
  });

  it("merges time of day with reference date", () => {
    const ref = new Date("2026-07-13T08:00:00.000Z");
    const ms = parseTimeOfDayMs("17:20:10.246");
    const merged = mergeTimeWithDate(ms, ref);
    expect(merged).not.toBeNull();
    expect(merged.getHours()).toBe(17);
    expect(merged.getMinutes()).toBe(20);
  });
});
