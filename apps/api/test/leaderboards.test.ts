import { localDateIn, seasonForDate, type DayDto, type LeaderboardDto } from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { playerCards, seasons, users } from "../src/db/schema";
import { rank } from "../src/services/leaderboard-service";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;
type App = Awaited<ReturnType<typeof createRatedApp>>;

/** A dev player with a cached card this season (no ledger needed for boards). */
async function player(
  t: App,
  username: string,
  card: {
    overall: number;
    recappedDays?: number;
    flaggedDays?: number;
    categories?: [string, string | null, number][];
  },
  settings: { profileVisibility?: string; leaderboardOptIn?: boolean } = {},
) {
  // The first request creates the dev user.
  const res = Object.keys(settings).length
    ? await t.request("/me", { user: username, method: "PATCH", ...json(settings) })
    : await t.request("/me", { user: username });
  if (!res.ok) throw new Error(`Setting up ${username} failed: ${res.status}`);
  const [user] = await t.db.select().from(users).where(eq(users.username, username));
  const period = seasonForDate(localDateIn("UTC"));
  const [season] = await t.db
    .insert(seasons)
    .values({ userId: user!.id, ...period, status: "active" })
    .returning();
  await t.db.insert(playerCards).values({
    userId: user!.id,
    seasonId: season!.id,
    seasonLabel: period.label,
    overall: card.overall,
    archetype: null,
    categories: (card.categories ?? []).map(([name, templateKey, value]) => ({
      name,
      templateKey,
      value,
    })),
    recappedDays: card.recappedDays ?? 10,
    flaggedDays: card.flaggedDays ?? 0,
  });
}

async function befriend(t: App, username: string) {
  await t.request(`/friends/${username}`, { method: "POST" });
  await t.request("/friends/tester", { user: username, method: "POST" });
}

const board = async (t: App, query: string, user = "tester") =>
  body<LeaderboardDto>(await t.request(`/leaderboards?${query}`, { user }));

describe("rank", () => {
  it("orders by value and shares ranks on ties", () => {
    const rows = [
      { value: 70, recappedDays: 5, username: "a" },
      { value: 80, recappedDays: 5, username: "b" },
      { value: 70, recappedDays: 9, username: "c" },
      { value: 60, recappedDays: 5, username: "d" },
    ];
    expect(rank(rows)).toEqual([
      { index: 1, rank: 1 },
      { index: 2, rank: 2 }, // more recapped days breaks the display order, not the rank
      { index: 0, rank: 2 },
      { index: 3, rank: 4 },
    ]);
  });
});

describe("leaderboards", () => {
  it("friends boards show you and friends who share with friends", async () => {
    const t = await createRatedApp();
    await t.request("/ratings"); // writes tester's card
    await player(t, "amy", { overall: 90, recappedDays: 3 }, { profileVisibility: "friends" });
    await player(t, "ben", { overall: 40 }, { profileVisibility: "public" });
    await player(t, "cal", { overall: 99 }); // private: hidden even from friends
    await player(t, "dee", { overall: 95 }, { profileVisibility: "public" }); // not a friend
    for (const name of ["amy", "ben", "cal"]) await befriend(t, name);

    const result = await board(t, "scope=friends");
    expect(result.entries.map((e) => e.username)).toEqual(["amy", "tester", "ben"]);
    expect(result.entries[0]).toMatchObject({ rank: 1, provisional: true });
    expect(result.me).toMatchObject({ username: "tester", rank: 2, isMe: true });
  });

  it("global boards need a public profile, opt-in, and enough clean recaps", async () => {
    const t = await createRatedApp();
    const optIn = { profileVisibility: "public", leaderboardOptIn: true };
    await player(t, "amy", { overall: 80 }, optIn);
    await player(t, "ben", { overall: 85 }, { profileVisibility: "public" }); // not opted in
    await player(t, "cal", { overall: 90 }, { leaderboardOptIn: true }); // private
    await player(t, "dee", { overall: 95, recappedDays: 6 }, optIn); // provisional
    await player(t, "eve", { overall: 97, recappedDays: 10, flaggedDays: 6 }, optIn); // flagged
    await player(t, "fay", { overall: 70, recappedDays: 10, flaggedDays: 4 }, optIn); // fine

    const result = await board(t, "scope=global");
    expect(result.entries.map((e) => e.username)).toEqual(["amy", "fay"]);
    expect(result.me).toBeNull();

    // Tester hasn't opted in and has no recaps; the status says why.
    await t.request("/ratings");
    const status = (await board(t, "scope=global")).globalStatus;
    expect(status).toMatchObject({ optedIn: false, visibility: "private", hasCard: true });
    expect(status.reasons).toEqual(["few-recaps"]);
    expect((await board(t, "scope=global", "eve")).globalStatus.reasons).toEqual(["flagged"]);
  });

  it("category boards rank template categories only", async () => {
    const t = await createRatedApp();
    const optIn = { profileVisibility: "public", leaderboardOptIn: true };
    await player(t, "amy", { overall: 60, categories: [["Training", "fitness", 88]] }, optIn);
    await player(t, "ben", { overall: 90, categories: [["Fitness", null, 99]] }, optIn); // custom
    await player(t, "cal", { overall: 70, categories: [["Fitness", "fitness", 75]] }, optIn);

    const result = await board(t, "scope=global&board=fitness");
    expect(result.entries.map((e) => [e.username, e.value])).toEqual([
      ["amy", 88],
      ["cal", 75],
    ]);
    expect((await t.request("/leaderboards?board=chess")).status).toBe(400);
  });

  it("count flagged recaps on the owner's card", async () => {
    const t = await createRatedApp([
      jsonResult({
        changes: [{ ref: "n3", delta: 3, reason: "Ran.", evidence: "run" }],
        narrative: "Big claims.",
        flags: ["Claimed a marathon PR with no training logged."],
        nextPrompts: [],
      }),
    ]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    await t.request(`/days/${today}/journal`, {
      method: "PUT",
      ...json({ journal: "Marathon PR!" }),
    });
    await t.request(`/days/${today}/recap`, { method: "POST" });
    await t.request("/ratings");

    const [card] = await t.db.select().from(playerCards);
    expect(card).toMatchObject({ recappedDays: 1, flaggedDays: 1 });
  });
});
