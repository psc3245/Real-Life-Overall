import { describe, expect, it } from "vitest";
import {
  aggregatePoints,
  correlation,
  describeCorrelation,
  linearTrend,
  movingAverage,
  rangeStart,
  seriesStats,
  summarizeSeries,
} from "./metrics";

const pts = (...values: number[]) =>
  values.map((value, i) => ({ date: `2026-10-${String(i + 12).padStart(2, "0")}`, value }));

describe("metric math", () => {
  it("aggregates by kind: amounts sum, levels keep the last, sessions keep the best", () => {
    // 2026-10-12 is a Monday; weeks start Monday.
    const week = pts(1, 2, 3, 4, 5, 6, 7, 8);
    expect(aggregatePoints(week, "week", "amount", 1)).toEqual([
      { date: "2026-10-12", value: 28 },
      { date: "2026-10-19", value: 8 },
    ]);
    expect(aggregatePoints(week, "week", "level", 1)[0]!.value).toBe(7);
    expect(aggregatePoints(pts(5, 9, 2), "month", "session", 1)).toEqual([
      { date: "2026-10-01", value: 9 },
    ]);
  });

  it("smooths, fits a trend and projects it", () => {
    expect(movingAverage(pts(2, 4, 6), 2).map((p) => p.value)).toEqual([2, 3, 5]);
    const t = linearTrend(pts(10, 12, 14, 16), 2)!;
    expect(t.slope).toBeCloseTo(2);
    expect(t.r2).toBeCloseTo(1);
    expect(t.line.at(-1)).toEqual({ date: "2026-10-17", value: 20 });
    expect(linearTrend(pts(1, 2))).toBeNull();
  });

  it("correlates series on shared dates", () => {
    const c = correlation(pts(1, 2, 3, 4), pts(2, 4, 6, 8))!;
    expect(c.r).toBeCloseTo(1);
    expect(c.n).toBe(4);
    expect(describeCorrelation(-0.5)).toBe("moderate negative");
    expect(describeCorrelation(0.1)).toBe("no clear relationship");
  });

  it("finds where a range starts", () => {
    expect(rangeStart("30d", "2026-10-25", "2026-10-01", "2026-01-01")).toBe("2026-09-26");
    expect(rangeStart("season", "2026-10-25", "2026-10-01", "2026-01-01")).toBe("2026-10-01");
  });
});

describe("series stats and summaries", () => {
  it("summarizes levels with change, trend and target", () => {
    const stats = seriesStats(pts(55.8, 56.2, 56.9, 57.4), "level", "day");
    expect(stats).toMatchObject({ latest: 57.4, change: 1.6, min: 55.8, max: 57.4 });
    expect(
      summarizeSeries({ label: "Overall", unit: "", kind: "level", target: 60 }, stats, "day"),
    ).toBe(
      "Overall rose to 57.4 (+1.6), ranging 55.8–57.4, trending up about 0.55 per day, 2.6 short of the 60 target.",
    );
  });

  it("summarizes amounts as totals and handles empty series", () => {
    const stats = seriesStats(pts(0, 40, 0, 60), "amount", "day");
    expect(
      summarizeSeries(
        { label: "Deep work", unit: "min", kind: "amount", target: null },
        stats,
        "day",
      ),
    ).toMatch(/^Deep work totaled 100 min, about 25 min per day, peaking at 60 min/);
    expect(
      summarizeSeries(
        { label: "Weight", unit: "lb", kind: "level", target: null },
        seriesStats([], "level", "day"),
        "day",
      ),
    ).toBe("Weight: nothing logged.");
  });
});
