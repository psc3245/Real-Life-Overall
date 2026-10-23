import type { DayDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";

describe("id parameters", () => {
  it("answer 404 for ids that aren't uuids, never a server error", async () => {
    const t = await createRatedApp();
    const today = ((await (await t.request("/days/today")).json()) as DayDto).today;
    const cases: [string, RequestInit][] = [
      ["/habits/bad", { method: "PATCH", ...json({ name: "x" }) }],
      ["/habits/bad", { method: "DELETE" }],
      [`/days/${today}/habits/bad`, { method: "PUT", ...json({ num: 1 }) }],
      ["/pauses/bad/end", { method: "POST", ...json({ endsOn: today }) }],
      ["/goals/bad", { method: "PUT", ...json({ target: 50 }) }],
      ["/weekly/bad", {}],
      ["/weekly/bad/proposals/0/accept", { method: "POST" }],
      ["/seasons/bad", {}],
    ];
    for (const [path, init] of cases) {
      expect((await t.request(path, init)).status, `${init.method ?? "GET"} ${path}`).toBe(404);
    }
  });

  it("fall back to defaults for bad day counts", async () => {
    const t = await createRatedApp();
    expect((await t.request("/ratings/history?days=abc")).status).toBe(200);
    expect((await t.request("/ratings/activity?days=-5")).status).toBe(200);
  });
});
