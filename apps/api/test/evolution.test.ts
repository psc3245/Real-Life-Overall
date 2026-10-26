import type {
  RatingsDto,
  ScoutingReportDto,
  TreeProposalDto,
  WeeklyStateDto,
  WeightsDto,
} from "@rlo/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { ratingEvents, seasons, users, weightChanges } from "../src/db/schema";
import { canProposeTreeChange } from "../src/services/evolution-service";
import { loadLeafContext } from "../src/services/habit-service";
import { createRatedApp, json } from "./flows";
import { jsonResult } from "./helpers";

// Standard tree refs: Fitness n1, Career n2, Cardio n3, Strength n4. Leaves n2, n3, n4.
const review = (over: Record<string, unknown> = {}) =>
  jsonResult({
    narrative: "A week of shipping and family time.",
    corrections: [],
    decayRevisions: [],
    focusGoals: [{ title: "Ship", detail: "Ship it.", refs: [] }],
    habitProposals: [],
    profileSummary: "Engineer and parent.",
    projections: [],
    archetype: null,
    personalBadge: null,
    scoutingReport: {
      aspirations: ["Lead a team", "  ", "Be present for my kids"],
      priorities: [
        { area: "Career", importance: 5, ref: "n2", note: "Promotion this year." },
        { area: "Family", importance: 9, ref: null, note: "Two young kids." },
        { area: "career", importance: 1, ref: "n2", note: "Duplicate." },
        { area: "Fitness", importance: 2, ref: "n99", note: "" },
      ],
      focuses: ["Promotion packet"],
      constraints: ["Evenings belong to the kids"],
    },
    weightShifts: [
      { ref: "n2", change: 0.5, reason: "Career dominates every journal." },
      { ref: "n4", change: -0.1, reason: "Strength never comes up." },
      { ref: "n2", change: 0.1, reason: "Duplicate." },
      { ref: "overall", change: 0.1, reason: "Not a node." },
    ],
    treeChange: {
      reason: "Family is a core priority the tree doesn't measure.",
      changes: [
        {
          kind: "add_category",
          ref: null,
          name: "Family",
          description: "Time and presence at home.",
          attributes: [
            { name: "Presence", description: "Undistracted time with the kids." },
            { name: "Partnership", description: "" },
            { name: "presence", description: "Duplicate." },
          ],
        },
        { kind: "remove", ref: "n4", name: null, description: null, attributes: [] },
        // Fitness would lose its last attribute: dropped.
        { kind: "remove", ref: "n3", name: null, description: null, attributes: [] },
      ],
    },
    ...over,
  });

const newLeafRatings = jsonResult({
  ratings: ["n5", "n6"].map((ref) => ({
    ref,
    value: 60,
    confidence: "low",
    rationale: "Little evidence yet.",
    decayGraceDays: 5,
    decayPerDay: 0.2,
    decayFloor: 45,
  })),
});

const body = async <T>(res: Response) => (await res.json()) as T;

async function setup(responses = [review()]) {
  const t = await createRatedApp(responses);
  await t.db.update(ratingEvents).set({ createdAt: new Date(Date.now() - 14 * 86_400_000) });
  // Keep proposals allowed whatever the real date (none in a season's last two weeks).
  await t.db.update(seasons).set({ endsOn: "2099-12-31" });
  const run = async () => body<WeeklyStateDto>(await t.request("/weekly/run", { method: "POST" }));
  const weights = async () => body<WeightsDto>(await t.request("/weights"));
  return { ...t, run, weights };
}

describe("scouting report", () => {
  it("is rewritten by the weekly review, with priorities mapped to tree nodes", async () => {
    const t = await setup();
    const empty = await body<ScoutingReportDto>(await t.request("/scouting-report"));
    expect(empty).toMatchObject({ aspirations: [], priorities: [], updatedBy: null });

    await t.run();
    const report = await body<ScoutingReportDto>(await t.request("/scouting-report"));
    expect(report.aspirations).toEqual(["Lead a team", "Be present for my kids"]);
    expect(report.priorities.map((p) => [p.area, p.importance, p.nodeName])).toEqual([
      ["Career", 5, "Career"],
      ["Family", 5, null],
      ["Fitness", 2, null],
    ]);
    expect(report.updatedBy).toBe("scout");

    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Scouting Report:\\nEmpty so far");
    expect(prompt).toContain("[n2] Career: ");
    expect(prompt).toContain("Tree change: allowed this week");
  });

  it("takes the player's own edits", async () => {
    const t = await setup();
    const res = await t.request("/scouting-report", {
      method: "PUT",
      ...json({
        aspirations: ["Run a marathon"],
        priorities: [{ area: "Endurance", importance: 4, nodeId: t.nodeId("Cardio"), note: "" }],
        focuses: [],
        constraints: [],
      }),
    });
    expect(res.status).toBe(200);
    const report = await body<ScoutingReportDto>(res);
    expect(report.priorities[0]).toMatchObject({ nodeId: t.nodeId("Cardio"), nodeName: "Cardio" });
    expect(report.updatedBy).toBe("user");

    await t.run();
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Last edited by the user");
    expect(prompt).toContain("Endurance (importance 4/5, [n3] Cardio)");
  });
});

describe("adaptive weights", () => {
  it("shifts weights in capped steps that can be undone", async () => {
    const t = await setup();
    const before = await t.weights();
    const career = () => before.nodes.find((n) => n.name === "Career")!;
    const state = await t.run();
    const shifts = state.review!.weightShifts;
    expect(shifts.map((s) => s.nodeName).sort()).toEqual(["Career", "Strength"]);

    const after = await t.weights();
    const careerAfter = after.nodes.find((n) => n.name === "Career")!;
    expect(careerAfter.share).toBeGreaterThan(career().share);
    expect(careerAfter.startShare).toBe(career().share);
    expect(after.changes).toHaveLength(2);

    // +50% asked, +15% applied.
    const careerShift = shifts.find((s) => s.nodeName === "Career")!;
    const [row] = await t.db
      .select()
      .from(weightChanges)
      .where(eq(weightChanges.id, careerShift.id));
    expect(row!.toWeight / row!.fromWeight).toBeCloseTo(1.15, 3);

    const undone = await body<WeightsDto>(
      await t.request(`/weights/changes/${careerShift.id}/undo`, { method: "POST" }),
    );
    expect(undone.nodes.find((n) => n.name === "Career")!.share).toBe(career().share);
    expect(undone.changes.find((c) => c.id === careerShift.id)!.revertedAt).not.toBeNull();
    const again = await t.request(`/weights/changes/${careerShift.id}/undo`, { method: "POST" });
    expect(again.status).toBe(409);
    expect(
      (await t.request(`/weights/changes/${careerShift.id}/undo`, { method: "POST", user: "x" }))
        .status,
    ).toBe(404);
  });

  it("leaves the tree alone when adaptive rating is switched off", async () => {
    const t = await setup();
    await t.db.update(users).set({ preferences: { features: { adaptiveRating: false } } });
    const state = await t.run();
    expect(state.review!.weightShifts).toEqual([]);
    expect(state.review!.treeProposal).toBeNull();
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Weight shifts: switched off by the user");
    expect(prompt).toContain("Tree change: not allowed this week");
    expect((await t.weights()).adaptive).toBe(false);
  });
});

describe("tree proposals", () => {
  it("proposes validated changes that apply on accept and rate new attributes", async () => {
    const t = await setup([review(), newLeafRatings]);
    const proposal = (await t.run()).review!.treeProposal!;
    expect(proposal.status).toBe("pending");
    expect(proposal.changes).toEqual([
      {
        kind: "add_category",
        name: "Family",
        description: "Time and presence at home.",
        attributes: [
          { name: "Presence", description: "Undistracted time with the kids." },
          { name: "Partnership", description: "" },
        ],
      },
      { kind: "remove", nodeId: t.nodeId("Strength"), nodeName: "Strength" },
    ]);

    const accepted = await body<TreeProposalDto>(
      await t.request(`/tree-proposals/${proposal.id}/accept`, { method: "POST" }),
    );
    expect(accepted.status).toBe("accepted");
    const ratings = await body<RatingsDto>(await t.request("/ratings"));
    const names = ratings.nodes.map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(["Family", "Presence", "Partnership"]));
    expect(names).not.toContain("Strength");
    expect(ratings.nodes.find((n) => n.name === "Presence")!.value).toBe(60);

    const again = await t.request(`/tree-proposals/${proposal.id}/dismiss`, { method: "POST" });
    expect(again.status).toBe(409);
  });

  it("waits out the cooldown before proposing again", async () => {
    const t = await setup();
    const proposal = (await t.run()).review!.treeProposal!;
    await t.request(`/tree-proposals/${proposal.id}/dismiss`, { method: "POST" });
    const list = await body<TreeProposalDto[]>(await t.request("/tree-proposals"));
    expect(list.map((p) => p.status)).toEqual(["dismissed"]);

    const user = (await t.db.select().from(users))[0]!;
    const ctx = (await loadLeafContext(t.db, user.id))!;
    const today = new Date().toISOString().slice(0, 10);
    expect(await canProposeTreeChange(t.db, user.id, ctx, today)).toBe(false);
    const later = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    expect(await canProposeTreeChange(t.db, user.id, ctx, later)).toBe(true);
  });
});
