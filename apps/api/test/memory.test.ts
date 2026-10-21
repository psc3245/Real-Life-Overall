import { addDays, type DayDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { searchMemories, toSearchQuery } from "../src/services/memory-service";
import { json } from "./flows";
import { createTestApp } from "./helpers";

describe("toSearchQuery", () => {
  it("ORs distinctive words, dropping short and stop words", () => {
    expect(toSearchQuery("Ran the river loop today with Sam, felt strong")).toBe(
      "strong | river | loop | felt",
    );
    expect(toSearchQuery("ok so it was a day")).toBeNull();
    expect(toSearchQuery("drop table users; -- ' | & !")).toBe("table | users | drop");
  });
});

describe("searchMemories", () => {
  it("finds earlier journals that share words, best match first, excluding recent days", async () => {
    const { request, db } = await createTestApp();
    const me = (await (await request("/me")).json()) as { id: string };
    const today = ((await (await request("/days/today")).json()) as DayDto).today;
    const write = (offset: number, journal: string) =>
      request(`/days/${addDays(today, offset)}/journal`, { method: "PUT", ...json({ journal }) });
    await write(-3, "Long run along the river loop, knees sore afterwards.");
    await write(-2, "Quiet day of meetings and email.");
    await write(-1, "River loop run again, knees fine this time.");

    const memories = await searchMemories(db, me.id, "Planning another river loop run tomorrow", {
      before: addDays(today, -1),
    });
    expect(memories.map((m) => [m.date, m.kind])).toEqual([[addDays(today, -3), "journal"]]);
    expect(memories[0]!.text).toContain("knees sore");
  });
});
