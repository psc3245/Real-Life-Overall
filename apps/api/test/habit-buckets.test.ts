import { bucketHabits, type HabitBucketDto, type HabitDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("habit buckets", () => {
  it("file habits into ordered buckets, and unfile them when a bucket goes", async () => {
    const t = await createRatedApp();
    const bucket = async (name: string) =>
      t.request("/habits/buckets", { method: "POST", ...json({ name }) });
    const morning = await body<HabitBucketDto>(await bucket("Morning"));
    const health = await body<HabitBucketDto>(await bucket("Health"));
    expect((await bucket("morning")).status).toBe(409);

    const post = async (input: Record<string, unknown>) =>
      body<HabitDto>(await t.request("/habits", { method: "POST", ...json(input) }));
    const stretch = await post({ name: "Stretch", type: "checkbox", bucketId: morning.id });
    const water = await post({ name: "Water", type: "checkbox", bucketId: health.id });
    const loose = await post({ name: "Read", type: "checkbox" });
    expect(stretch.bucketId).toBe(morning.id);

    // Reorder: Health first.
    const ordered = await body<HabitBucketDto[]>(
      await t.request("/habits/buckets/order", {
        method: "PUT",
        ...json({ ids: [health.id, morning.id] }),
      }),
    );
    const habits = await body<HabitDto[]>(await t.request("/habits"));
    expect(
      bucketHabits(habits, (h) => h, ordered).map((g) => [
        g.bucket?.name ?? null,
        g.items.map((h) => h.name),
      ]),
    ).toEqual([
      ["Health", ["Water"]],
      ["Morning", ["Stretch"]],
      [null, ["Read"]],
    ]);

    // Move a habit, rename a bucket, then delete one.
    const moved = await body<HabitDto>(
      await t.request(`/habits/${loose.id}`, { method: "PATCH", ...json({ bucketId: health.id }) }),
    );
    expect(moved.bucketId).toBe(health.id);
    const renamed = await body<HabitBucketDto>(
      await t.request(`/habits/buckets/${morning.id}`, {
        method: "PATCH",
        ...json({ name: "AM" }),
      }),
    );
    expect(renamed.name).toBe("AM");
    expect((await t.request(`/habits/buckets/${health.id}`, { method: "DELETE" })).status).toBe(
      204,
    );
    const after = await body<HabitDto[]>(await t.request("/habits"));
    expect(after.find((h) => h.id === water.id)?.bucketId).toBeNull();
    expect(
      (
        await t.request("/habits", {
          method: "POST",
          ...json({ name: "X", type: "checkbox", bucketId: health.id }),
        })
      ).status,
    ).toBe(400);
  });
});
