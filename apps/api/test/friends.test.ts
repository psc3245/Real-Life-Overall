import { MAX_PENDING_FRIEND_REQUESTS, type FriendsDto, type ProfileDto } from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";

const body = async <T>(res: Response) => (await res.json()) as T;

describe("friends", () => {
  it("request, accept, and see each other's friends-only card", async () => {
    const t = await createRatedApp(); // "tester" has a rating
    await t.request("/me", { method: "PATCH", ...json({ profileVisibility: "friends" }) });
    await t.request("/me", { user: "sam" });

    // Not friends yet: the friends-only profile is hidden.
    expect((await t.request("/profiles/tester", { user: "sam" })).status).toBe(404);

    const sent = await t.request("/friends/Tester", { user: "sam", method: "POST" });
    expect(await body<{ state: string }>(sent)).toEqual({ state: "outgoing" });
    // Sending again is a no-op.
    expect(
      await body<{ state: string }>(
        await t.request("/friends/tester", { user: "sam", method: "POST" }),
      ),
    ).toEqual({ state: "outgoing" });

    const pending = await body<FriendsDto>(await t.request("/friends"));
    expect(pending.incoming.map((f) => f.username)).toEqual(["sam"]);
    expect(pending.friends).toEqual([]);

    // Befriending someone who already asked accepts their request.
    const accepted = await t.request("/friends/sam", { method: "POST" });
    expect(await body<{ state: string }>(accepted)).toEqual({ state: "friends" });

    const samView = await body<ProfileDto>(await t.request("/profiles/tester", { user: "sam" }));
    expect(samView).toMatchObject({ friendship: "friends", isSelf: false });
    expect(samView.card?.archetype).toBe("Desk Athlete");

    const samFriends = await body<FriendsDto>(await t.request("/friends", { user: "sam" }));
    expect(samFriends.friends).toHaveLength(1);
    expect(samFriends.friends[0]).toMatchObject({ username: "tester" });
    expect(samFriends.friends[0]!.card?.overall).toBeGreaterThan(0);

    // Unfriending hides the card again.
    await t.request("/friends/tester", { user: "sam", method: "DELETE" });
    expect((await t.request("/profiles/tester", { user: "sam" })).status).toBe(404);
    expect((await body<FriendsDto>(await t.request("/friends"))).friends).toEqual([]);
  });

  it("keep private cards private, even from friends", async () => {
    const t = await createRatedApp();
    await t.request("/me", { user: "sam" });
    await t.request("/friends/sam", { method: "POST" });
    await t.request("/friends/tester", { user: "sam", method: "POST" });

    expect((await t.request("/profiles/tester", { user: "sam" })).status).toBe(404);
    const list = await body<FriendsDto>(await t.request("/friends", { user: "sam" }));
    expect(list.friends[0]).toMatchObject({ username: "tester", card: null });
  });

  it("report each side's state on public profiles and decline cleanly", async () => {
    const t = await createRatedApp();
    await t.request("/me", { method: "PATCH", ...json({ profileVisibility: "public" }) });
    await t.request("/friends/tester", { user: "sam", method: "POST" });

    expect(
      (await body<ProfileDto>(await t.request("/profiles/tester", { user: "sam" }))).friendship,
    ).toBe("outgoing");
    expect((await body<ProfileDto>(await t.request("/profiles/tester"))).friendship).toBeNull();

    await t.request("/friends/sam", { method: "DELETE" }); // decline
    const list = await body<FriendsDto>(await t.request("/friends", { user: "sam" }));
    expect(list.outgoing).toEqual([]);
  });

  it("reject unknown players, yourself, and request spam", async () => {
    const t = await createRatedApp();
    expect((await t.request("/friends/ghost", { method: "POST" })).status).toBe(404);
    expect((await t.request("/friends/tester", { method: "POST" })).status).toBe(400);

    for (let i = 0; i < MAX_PENDING_FRIEND_REQUESTS; i++) {
      await t.request("/me", { user: `p${i}x` });
      expect((await t.request(`/friends/p${i}x`, { method: "POST" })).status).toBe(200);
    }
    await t.request("/me", { user: "onemore" });
    expect((await t.request("/friends/onemore", { method: "POST" })).status).toBe(429);
  });
});
