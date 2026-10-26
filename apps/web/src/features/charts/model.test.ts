import type { MetricDto, MetricSeriesDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { buildChart, chartHref } from "./model";

const metric = (id: string, unit: string, kind: MetricDto["kind"] = "level"): MetricDto => ({
  id,
  group: "ratings",
  label: id,
  unit,
  kind,
  target: null,
  detail: null,
});
const days = (values: number[]) =>
  values.map((value, i) => ({ date: `2026-10-${String(i + 12).padStart(2, "0")}`, value }));

describe("buildChart", () => {
  const series: MetricSeriesDto[] = [
    { metric: metric("weight", "lb"), points: days([180, 179, 178, 177]) },
    { metric: metric("run", "min", "amount"), points: days([30, 40, 50, 60]) },
    { metric: metric("bench", "lb", "session"), points: days([135, 140, 145, 150]) },
  ];

  it("merges series by date with one axis per unit", () => {
    const m = buildChart(series, { bucket: "day", average: false, trend: false }, 1);
    expect(m.rows).toHaveLength(4);
    expect(m.rows[0]).toEqual({ date: "2026-10-12", s0: 180, s1: 30, s2: 135 });
    expect(m.axes).toEqual([
      { id: "y0", unit: "lb" },
      { id: "y1", unit: "min" },
    ]);
    expect(m.lines.map((l) => l.axis)).toEqual(["y0", "y1", "y0"]);
  });

  it("summarizes, fits trends and correlates the first two series", () => {
    const m = buildChart(series, { bucket: "day", average: true, trend: true }, 1);
    expect(m.stats[0]).toMatchObject({ latest: 177, change: -3, slope: -1, r2: 1 });
    expect(m.stats[1]).toMatchObject({ total: 180, change: null, slope: 10 });
    expect(m.correlation!.r).toBeCloseTo(-1);
    // The trend projects 14 days past the last point.
    expect(m.rows.at(-1)).toMatchObject({ date: "2026-10-29", "s0~trend": 163 });
    expect(m.rows[1]).toHaveProperty("s1~avg", 35);
  });

  it("aggregates weekly by kind", () => {
    const m = buildChart(series, { bucket: "week", average: false, trend: false }, 1);
    expect(m.rows).toEqual([{ date: "2026-10-12", s0: 177, s1: 180, s2: 150 }]);
  });
});

describe("chartHref", () => {
  it("encodes metrics and options", () => {
    expect(chartHref(["habit:1", "goal:2"], { range: "all", trend: true })).toBe(
      "/charts?m=habit%3A1%2Cgoal%3A2&range=all&trend=1",
    );
  });
});
