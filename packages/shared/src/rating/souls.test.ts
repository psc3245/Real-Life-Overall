import { describe, expect, it } from "vitest";
import {
  bossSouls,
  emptyEarnings,
  foldSouls,
  leafLevelsAsOf,
  levelCost,
  levelFromRating,
  type DeathCause,
  type SoulDayInput,
} from "./souls";

const day = (
  date: string,
  earned: number,
  opts: { logged?: boolean; paused?: boolean; deaths?: DeathCause[] } = {},
): SoulDayInput => ({
  date,
  earned: { ...emptyEarnings(), recap: earned },
  logged: opts.logged ?? true,
  paused: opts.paused ?? false,
  deaths: opts.deaths ?? [],
});

describe("levels", () => {
  it("starts a typical adult at 20 and stays in 1-99", () => {
    expect(levelFromRating(50)).toBe(20);
    expect(levelFromRating(null)).toBe(20);
    expect(levelFromRating(0)).toBe(1);
    expect(levelFromRating(100)).toBe(40);
  });

  it("costs more every level, with jumps at the soft caps", () => {
    expect(levelCost(1)).toBe(100);
    expect(levelCost(20)).toBe(660);
    const before = levelCost(39)!;
    const after = levelCost(40)!;
    expect(after / before).toBeGreaterThan(1.4);
    expect(levelCost(60)! / levelCost(59)!).toBeGreaterThan(1.9);
    for (let l = 1; l < 98; l++) expect(levelCost(l + 1)!).toBeGreaterThanOrEqual(levelCost(l)!);
    expect(levelCost(99)).toBeNull();
  });

  it("pays bosses by the length of the fight, capped", () => {
    expect(bossSouls(7)).toBe(390);
    expect(bossSouls(10_000)).toBe(3000);
  });
});

describe("foldSouls", () => {
  it("adds up earnings and pays spends", () => {
    const s = foldSouls(
      [day("2026-11-01", 300), day("2026-11-02", 200)],
      [{ afterDate: "2026-11-02", cost: 400 }],
    );
    expect(s.held).toBe(100);
    expect(s.earned).toBe(500);
    expect(s.spent).toBe(400);
  });

  it("drops held souls on a death and picks them up the next good day", () => {
    const s = foldSouls(
      [
        day("2026-11-01", 500),
        day("2026-11-02", 0, { logged: false, deaths: ["missed"] }),
        day("2026-11-03", 100),
      ],
      [],
    );
    expect(s.days[1]!.dropped).toBe(500);
    expect(s.days[2]!.recovered).toBe(500);
    expect(s.held).toBe(600);
    expect(s.bloodstain).toBeNull();
    expect(s.deaths).toBe(1);
  });

  it("loses the bloodstain for good on a second death", () => {
    const s = foldSouls(
      [
        day("2026-11-01", 500),
        day("2026-11-02", 50, { deaths: ["slip"] }),
        day("2026-11-03", 80, { deaths: ["bad_day"] }),
      ],
      [],
    );
    expect(s.lost).toBe(550);
    expect(s.bloodstain).toEqual({ amount: 80, date: "2026-11-03" });
    expect(s.held).toBe(0);
  });

  it("keeps the bloodstain waiting through unlogged and paused days", () => {
    const s = foldSouls(
      [
        day("2026-11-01", 500, { deaths: ["slip"] }),
        day("2026-11-02", 0, { logged: false }),
        day("2026-11-03", 0, { logged: false, paused: true, deaths: ["missed"] }),
        day("2026-11-04", 0),
      ],
      [],
    );
    expect(s.deaths).toBe(1);
    expect(s.days[3]!.recovered).toBe(500);
  });

  it("never refunds a level bought on a day that later turns into a death", () => {
    const s = foldSouls(
      [day("2026-11-01", 500), day("2026-11-02", 0, { deaths: ["slip"] })],
      [{ afterDate: "2026-11-02", cost: 400 }],
    );
    expect(s.days[1]!.dropped).toBe(100);
    expect(s.held).toBe(0);
    const owed = foldSouls(
      [day("2026-11-01", 300, { deaths: ["slip"] }), day("2026-11-02", 0, { deaths: ["slip"] })],
      [{ afterDate: "2026-11-02", cost: 300 }],
    );
    // The recovery the spend counted on never happened.
    expect(owed.held).toBe(-300);
  });
});

describe("leafLevelsAsOf", () => {
  it("adds levels bought by the date to the start, skipping leaves not started yet", () => {
    const rows = [
      { nodeId: "a", kind: "start" as const, levels: 20, afterDate: "2026-11-01" },
      { nodeId: "a", kind: "level_up" as const, levels: 1, afterDate: "2026-11-02" },
      { nodeId: "a", kind: "level_up" as const, levels: 1, afterDate: "2026-11-04" },
      { nodeId: "b", kind: "start" as const, levels: 30, afterDate: "2026-11-03" },
    ];
    expect([...leafLevelsAsOf(rows, "2026-11-02")]).toEqual([["a", 21]]);
    expect(leafLevelsAsOf(rows, "2026-11-04")).toEqual(
      new Map([
        ["a", 22],
        ["b", 30],
      ]),
    );
  });
});
