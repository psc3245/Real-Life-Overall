/**
 * Seeds a demo player with ~3 weeks of realistic history so the app can be seen "over time":
 * a rated tree, habits with entries, journals, daily recaps that moved ratings, a flu week with a
 * decay pause, guided questions, weekly reviews (focus goals, projections, a habit proposal, a
 * personal badge), goals, a "Morning routine" habit group, and a finished previous season with
 * its own ledger, logs and weekly reviews. Decay and catalog badges are then computed by the
 * app's own engine.
 *
 * Deterministic (seeded random) and repeatable: re-running replaces the demo account.
 * No LLM calls. Run with: npm run seed:demo -w @rlo/api
 *
 * Local test credentials for the demo account (sign in at /signin), or in AUTH_MODE=dev use
 * the dev user "demo".
 */
import {
  addDays,
  computeNodeValues,
  dayOfWeek,
  lastCompletedWeek,
  leafValuesFromEvents,
  localDateIn,
  normalizeHabitConfig,
  seasonForDate,
  type GuidedPromptDto,
  type HabitType,
} from "@rlo/shared";
import { eq, like, or } from "drizzle-orm";
import { passwordHasher } from "../src/auth/password";
import { createNeonDb } from "../src/db/client";
import {
  authAccounts,
  authUsers,
  dayLogs,
  decayRules,
  friendships,
  goals,
  habitEntries,
  habitLinks,
  habits,
  onboardingSessions,
  pauses,
  playerCards,
  ratingEvents,
  ratingNodes,
  recaps,
  seasons,
  userBadges,
  users,
} from "../src/db/schema";
import { awardBadges } from "../src/services/badge-service";
import { applyDecay } from "../src/services/decay-service";
import { getRatings } from "../src/services/ratings-service";

export const DEMO_EMAIL = "demo@example.test";
export const DEMO_PASSWORD = "demo-player-2026";
const DEMO_USERNAME = "demo";
const DEMO_NAME = "Jordan Reyes";
const TIMEZONE = "America/Chicago";

// Deterministic randomness (mulberry32) so every run tells the same story. Extra stories (the
// previous season, the morning routine) get their own streams so they don't reshuffle this one.
function mulberry32(start: number) {
  let seed = start;
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261022);
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)]!;
const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;
/** An evening timestamp on a local date (kept on that date for US timezones). */
const evening = (date: string) => new Date(`${date}T23:00:00Z`);

/**
 * Other players for the social features: just a user, a season row and a cached card each (they
 * have no ledger and can't sign in). Their cards only change when the seed runs again. Public
 * rivals opt in to global boards; lucas has too few recaps to count there yet.
 */
const RIVAL_EMAIL_DOMAIN = "demo-rival.test";
const RIVALS: {
  username: string;
  name: string;
  visibility: "friends" | "public";
  link: "friends" | "incoming" | "none";
  archetype: string;
  recappedDays: number;
  categories: [name: string, templateKey: string | null, value: number][];
}[] = [
  {
    username: "maya",
    name: "Maya Chen",
    visibility: "friends",
    link: "friends",
    archetype: "Endurance Engine",
    recappedDays: 18,
    categories: [
      ["Fitness", "fitness", 78.4],
      ["Career", "career", 61.2],
      ["Social", "social", 66.0],
      ["Health", "health", 71.5],
    ],
  },
  {
    username: "devon",
    name: "Devon Brooks",
    visibility: "public",
    link: "friends",
    archetype: "Floor General",
    recappedDays: 21,
    categories: [
      ["Career", "career", 74.9],
      ["Mind", "mind", 69.3],
      ["Social", "social", 72.1],
      ["Guitar", null, 58.0],
    ],
  },
  {
    username: "priya",
    name: "Priya Natarajan",
    visibility: "public",
    link: "incoming",
    archetype: "Two-Way Scholar",
    recappedDays: 15,
    categories: [
      ["Mind", "mind", 81.0],
      ["Career", "career", 70.4],
      ["Fitness", "fitness", 55.7],
    ],
  },
  {
    username: "lucas",
    name: "Lucas Ortiz",
    visibility: "public",
    link: "none",
    archetype: "Raw Prospect",
    recappedDays: 4,
    categories: [
      ["Fitness", "fitness", 88.0],
      ["Career", "career", 52.3],
      ["Social", "social", 60.5],
    ],
  },
];

interface LeafSpec {
  name: string;
  description: string;
  weight: number;
  start: number;
  previous: number;
  decay: [graceDays: number, perDay: number];
}
interface CategorySpec {
  name: string;
  description: string;
  weight: number;
  templateKey: string | null;
  leaves: LeafSpec[];
}

const TREE: CategorySpec[] = [
  {
    name: "Career",
    description: "Growing into a senior engineer.",
    weight: 9,
    templateKey: "career",
    leaves: [
      {
        name: "Project Ownership",
        description: "Owning work end to end.",
        weight: 9,
        start: 62,
        previous: 58,
        decay: [10, 0.15],
      },
      {
        name: "Mentoring",
        description: "Helping junior engineers grow.",
        weight: 7,
        start: 55,
        previous: 52,
        decay: [14, 0.1],
      },
      {
        name: "Technical Skills",
        description: "Depth of craft.",
        weight: 6,
        start: 70,
        previous: 68,
        decay: [21, 0.1],
      },
    ],
  },
  {
    name: "Fitness",
    description: "Training for a spring half marathon.",
    weight: 8,
    templateKey: "fitness",
    leaves: [
      {
        name: "Endurance",
        description: "Running volume and aerobic base.",
        weight: 9,
        start: 58,
        previous: 54,
        decay: [4, 0.3],
      },
      {
        name: "Strength",
        description: "Lifting and resistance work.",
        weight: 5,
        start: 44,
        previous: 45,
        decay: [5, 0.25],
      },
      {
        name: "Mobility",
        description: "Stretching and range of motion.",
        weight: 3,
        start: 40,
        previous: 41,
        decay: [6, 0.2],
      },
    ],
  },
  {
    name: "Mind",
    description: "Focus and continuous learning.",
    weight: 6,
    templateKey: "mind",
    leaves: [
      {
        name: "Focus",
        description: "Deep work without distraction.",
        weight: 7,
        start: 60,
        previous: 57,
        decay: [5, 0.2],
      },
      {
        name: "Learning",
        description: "Reading and study.",
        weight: 6,
        start: 57,
        previous: 55,
        decay: [7, 0.15],
      },
    ],
  },
  {
    name: "Social",
    description: "Showing up for friends and family.",
    weight: 7,
    templateKey: "social",
    leaves: [
      {
        name: "Close Friends",
        description: "Time with the two closest friends.",
        weight: 8,
        start: 48,
        previous: 50,
        decay: [10, 0.2],
      },
      {
        name: "Family",
        description: "Staying in touch with parents.",
        weight: 6,
        start: 56,
        previous: 55,
        decay: [10, 0.15],
      },
    ],
  },
];

interface HabitSpec {
  name: string;
  type: HabitType;
  config: Parameters<typeof normalizeHabitConfig>[1];
  days: number[];
  links: string[];
  /** Value range when done (number habits); starts at the daily goal so "done" matches the app. */
  amount?: [number, number];
  /** Chance of doing it on a normal scheduled day. */
  rate: number;
}

const HABITS: HabitSpec[] = [
  {
    name: "Morning run",
    type: "duration",
    config: { target: 30 },
    days: [1, 3, 5, 6],
    links: ["Endurance"],
    amount: [30, 58],
    rate: 0.85,
  },
  { name: "Gym", type: "checkbox", config: {}, days: [2, 4], links: ["Strength"], rate: 0.65 },
  {
    name: "Read",
    type: "counter",
    config: { target: 20, unit: "pages" },
    days: [0, 1, 2, 3, 4, 5, 6],
    links: ["Learning"],
    amount: [20, 42],
    rate: 0.75,
  },
  {
    name: "Deep work",
    type: "duration",
    config: { target: 90 },
    days: [1, 2, 3, 4, 5],
    links: ["Focus", "Project Ownership"],
    amount: [90, 165],
    rate: 0.8,
  },
  {
    name: "Mentor session",
    type: "checkbox",
    config: {},
    days: [3],
    links: ["Mentoring"],
    rate: 0.85,
  },
  { name: "Call family", type: "checkbox", config: {}, days: [0], links: ["Family"], rate: 0.8 },
  {
    name: "Stretch",
    type: "checkbox",
    config: {},
    days: [0, 1, 2, 3, 4, 5, 6],
    links: ["Mobility"],
    rate: 0.45,
  },
];

const LIFE_NOTES = [
  "Dinner with Sam and Priya, first time in a while.",
  "Long walk at lunch to clear my head.",
  "Shipped the billing migration, smooth rollout.",
  "Code review marathon, unblocked two teammates.",
  "Cooked a proper meal instead of ordering in.",
  "Slept badly, dragged through the afternoon.",
  "Planning doc for the Q1 platform project got approved.",
  "Skipped plans with friends to finish a deadline, not proud of it.",
  "Paired with Alex on the caching bug for an hour.",
  "Quiet day, mostly meetings.",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (apps/api/.env)");
  const { db, dispose } = createNeonDb(url);
  try {
    await seedDemo(db);
  } finally {
    await dispose();
  }
}

async function seedDemo(db: ReturnType<typeof createNeonDb>["db"]) {
  // Replace any previous demo account (cascades remove its data).
  await db.delete(authUsers).where(eq(authUsers.email, DEMO_EMAIL));
  await db.delete(users).where(or(eq(users.email, DEMO_EMAIL), eq(users.username, DEMO_USERNAME)));

  const today = localDateIn(TIMEZONE);
  const season = seasonForDate(today);
  const previous = seasonForDate(addDays(season.startsOn, -1));
  const start = season.startsOn;
  const yesterday = addDays(today, -1);
  if (yesterday < addDays(start, 6)) {
    console.warn("The season started less than a week ago; history will be short.");
  }

  // Identity: a Better Auth credential account linked to the app user.
  const authId = crypto.randomUUID();
  await db
    .insert(authUsers)
    .values({ id: authId, name: DEMO_NAME, email: DEMO_EMAIL, emailVerified: true });
  await db.insert(authAccounts).values({
    id: crypto.randomUUID(),
    userId: authId,
    accountId: authId,
    providerId: "credential",
    password: await passwordHasher(100_000).hash(DEMO_PASSWORD),
  });
  const [user] = await db
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      username: DEMO_USERNAME,
      displayName: DEMO_NAME,
      timezone: TIMEZONE,
      weekStart: 1,
      authSubject: authId,
      profileSummary:
        "Software engineer aiming for senior by the March review; promotion hinges on owning projects end to end and mentoring. Training for a spring half marathon, running about four times a week. Lifts inconsistently. Tends to cancel plans with close friends when work gets busy but keeps up weekly calls with family. Had the flu mid-October and bounced back.",
    })
    .returning();
  const userId = user!.id;

  // Lineage ids are shared by the previous season's card and the current tree.
  const lineage = new Map<string, string>();
  const lineageOf = (name: string) => {
    if (!lineage.has(name)) lineage.set(name, crypto.randomUUID());
    return lineage.get(name)!;
  };

  // Previous season: archived with a frozen card, plus the ledger, logs and reviews behind it.
  const prevOverall = await seedPreviousSeason(db, userId, previous, lineageOf);

  // Current season and its tree.
  const [current] = await db
    .insert(seasons)
    .values({
      userId,
      ...season,
      status: "active",
      archetype: "Ambitious Builder",
      archetypeDescription:
        "Career-first, with a growing endurance base and social life to rebuild.",
    })
    .returning();
  const seasonId = current!.id;
  const nodeId = new Map<string, string>();
  const rootId = crypto.randomUUID();
  nodeId.set("Overall", rootId);
  const nodeRows: (typeof ratingNodes.$inferInsert)[] = [
    {
      id: rootId,
      seasonId,
      userId,
      parentId: null,
      lineageId: lineageOf("Overall"),
      name: "Overall",
      depth: 0,
    },
  ];
  TREE.forEach((c, ci) => {
    const catId = crypto.randomUUID();
    nodeId.set(c.name, catId);
    nodeRows.push({
      id: catId,
      seasonId,
      userId,
      parentId: rootId,
      lineageId: lineageOf(c.name),
      name: c.name,
      description: c.description,
      depth: 1,
      weight: c.weight,
      sortOrder: ci,
      templateKey: c.templateKey,
    });
    c.leaves.forEach((l, li) => {
      const id = crypto.randomUUID();
      nodeId.set(l.name, id);
      nodeRows.push({
        id,
        seasonId,
        userId,
        parentId: catId,
        lineageId: lineageOf(l.name),
        name: l.name,
        description: l.description,
        depth: 2,
        weight: l.weight,
        sortOrder: li,
      });
    });
  });
  await db.insert(ratingNodes).values(nodeRows);
  const leaves = TREE.flatMap((c) => c.leaves);

  // Onboarding: completed on the first day of the season.
  const onboardedAt = new Date(`${start}T15:00:00Z`);
  await db.insert(ratingEvents).values(
    leaves.map((l) => ({
      nodeId: nodeId.get(l.name)!,
      seasonId,
      delta: l.start,
      source: "onboarding" as const,
      reason: `Starting rating from your scouting report for ${l.name.toLowerCase()}.`,
      evidence: { confidence: "medium" },
      createdAt: onboardedAt,
    })),
  );
  await db.insert(decayRules).values(
    leaves.map((l) => ({
      nodeId: nodeId.get(l.name)!,
      graceDays: l.decay[0],
      perDay: l.decay[1],
      floor: round(l.start - 20, 1),
      authoredBy: "llm" as const,
      createdAt: onboardedAt,
    })),
  );
  await db.insert(onboardingSessions).values({
    userId,
    seasonId,
    stage: "complete",
    priorities:
      "Top goal: senior engineer promotion at the March review (project ownership, mentoring). Second: spring half marathon. Third: stop cancelling on two close friends; call parents weekly.",
    templateRationale:
      "Career leads because of the March review; fitness follows the half marathon goal.",
    discovery: {
      done: true,
      messages: [
        {
          role: "assistant",
          content: "Over the next few months, what do you want your life to look like?",
        },
        {
          role: "user",
          content:
            "Promoted to senior, running a half marathon in spring, and better about seeing friends.",
        },
        { role: "assistant", content: "What does the promotion hinge on?" },
        { role: "user", content: "Owning bigger projects end to end and mentoring juniors." },
        { role: "assistant", content: "Thanks, I'll draft your rating tree." },
      ],
    },
    result: {
      summary:
        "Career is the strongest area; endurance is building; strength and close friendships are the gaps.",
      archetypeDescription:
        "Career-first, with a growing endurance base and social life to rebuild.",
    },
    createdAt: onboardedAt,
  });
  await db.insert(goals).values([
    { nodeId: rootId, targetValue: 64 },
    { nodeId: nodeId.get("Endurance")!, targetValue: 70 },
    { nodeId: nodeId.get("Project Ownership")!, targetValue: 75 },
  ]);

  // Habits.
  const habitIds = new Map<string, string>();
  await db.insert(habits).values(
    HABITS.map((h, i) => {
      const id = crypto.randomUUID();
      habitIds.set(h.name, id);
      return {
        id,
        userId,
        name: h.name,
        type: h.type,
        config: normalizeHabitConfig(h.type, h.config),
        days: h.days,
        startsOn: start,
        sortOrder: i,
        createdAt: onboardedAt,
      };
    }),
  );
  await db
    .insert(habitLinks)
    .values(
      HABITS.flatMap((h) =>
        h.links.map((l) => ({ habitId: habitIds.get(h.name)!, nodeLineageId: lineageOf(l) })),
      ),
    );

  // A flu week in the middle: barely anything logged, decay paused.
  const fluStart = addDays(start, 12);
  const fluEnd = addDays(start, 14);
  const isFlu = (d: string) => d >= fluStart && d <= fluEnd;
  if (fluEnd < today) {
    await db.insert(pauses).values({ userId, startsOn: fluStart, endsOn: fluEnd, reason: "Flu" });
  }

  // Day by day: entries, journal, guided questions, and a recap that moves ratings.
  const values = new Map(leaves.map((l) => [l.name, l.start]));
  const entries: (typeof habitEntries.$inferInsert)[] = [];
  const logs: (typeof dayLogs.$inferInsert)[] = [];
  const recapRows: (typeof recaps.$inferInsert)[] = [];
  const events: (typeof ratingEvents.$inferInsert)[] = [];
  const pendingPrompts = new Map<string, GuidedPromptDto[]>();

  for (let d = addDays(start, 1); d <= yesterday; d = addDays(d, 1)) {
    const flu = isFlu(d);
    const done: { habit: HabitSpec; value: number | null }[] = [];
    const missed: HabitSpec[] = [];
    for (const h of HABITS) {
      if (!h.days.includes(dayOfWeek(d))) continue;
      if (rand() < (flu ? 0.1 : h.rate)) {
        const value = h.amount ? Math.round(between(...h.amount)) : 1;
        entries.push({ habitId: habitIds.get(h.name)!, localDate: d, valueNum: value });
        done.push({ habit: h, value });
      } else missed.push(h);
    }

    const notes: string[] = [];
    if (flu)
      notes.push(
        pick([
          "Sick with the flu, mostly slept.",
          "Still feverish, stayed in.",
          "Feeling a bit better, took it easy.",
        ]),
      );
    for (const { habit, value } of done) {
      if (habit.name === "Morning run")
        notes.push(`Ran ${value} minutes${value! > 45 ? ", long and steady" : ""}.`);
      if (habit.name === "Gym")
        notes.push(
          pick([
            "Gym: squats and rows.",
            "Gym: deadlifts and pull-ups.",
            "Short gym session, upper body.",
          ]),
        );
      if (habit.name === "Mentor session")
        notes.push("Weekly mentoring session with Dana; we planned her first design review.");
      if (habit.name === "Deep work" && value! >= 120)
        notes.push("Long deep work block on the platform project.");
    }
    if (!flu && rand() < 0.6) notes.push(pick(LIFE_NOTES));
    if (!flu && notes.length === 0) {
      notes.push(pick(["Normal workday, nothing special.", "Busy but fine.", "Low-key day."]));
    }
    const social = notes.some((n) => /Sam and Priya|friends/.test(n) && !/Skipped/.test(n));
    const skippedFriends = notes.some((n) => /Skipped plans/.test(n));

    const prompts = pendingPrompts.get(d) ?? [];
    const answered = prompts.map((p) =>
      rand() < 0.7
        ? {
            ...p,
            answer: pick([
              "Yes, felt good.",
              "About seven hours.",
              "Twice this week.",
              "Not yet, planning it for Sunday.",
            ]),
          }
        : p,
    );
    const logged = done.length > 0 || notes.length > 0;
    if (!logged) continue;

    // Rating changes: linked habits done raise, scheduled misses dent; social notes count.
    const changes = new Map<string, { delta: number; reason: string; evidence: string }>();
    const bump = (leaf: string, delta: number, reason: string, evidence: string) => {
      const prior = changes.get(leaf);
      changes.set(leaf, {
        delta: (prior?.delta ?? 0) + delta,
        reason: prior?.reason ?? reason,
        evidence: prior?.evidence ?? evidence,
      });
    };
    for (const { habit, value } of done) {
      for (const leaf of habit.links) {
        const level = values.get(leaf)!;
        const gain =
          between(0.15, 0.5) *
          (level > 70 ? 0.6 : 1) *
          (habit.amount && value! > habit.amount[1] * 0.85 ? 1.4 : 1);
        bump(
          leaf,
          gain,
          `You ${habit.name === "Morning run" ? `ran ${value} minutes` : `logged ${habit.name.toLowerCase()}`}, which builds ${leaf.toLowerCase()}.`,
          habit.name,
        );
      }
    }
    if (!flu) {
      for (const habit of missed) {
        if (rand() < 0.35)
          bump(
            habit.links[0]!,
            -between(0.05, 0.2),
            `You skipped ${habit.name.toLowerCase()} on a scheduled day.`,
            habit.name,
          );
      }
    }
    if (social)
      bump(
        "Close Friends",
        between(0.4, 0.8),
        "Seeing your close friends is exactly the pattern you wanted to rebuild.",
        "Dinner with Sam and Priya",
      );
    if (skippedFriends)
      bump(
        "Close Friends",
        -0.4,
        "Cancelling on friends for work is the habit you said you want to break.",
        "Skipped plans",
      );

    const recapId = crypto.randomUUID();
    const narrative = flu
      ? "A sick day. Rest is the right call; decay is paused while you recover."
      : `${done.length >= 3 ? "A full day" : done.length ? "A steady day" : "A lighter day"}: ${done.map((x) => x.habit.name.toLowerCase()).join(", ") || "no habits logged"}.${social ? " Time with friends stood out." : ""}${skippedFriends ? " Cancelling plans with friends cost a little." : ""}`;
    recapRows.push({
      id: recapId,
      userId,
      seasonId,
      kind: "daily",
      periodStart: d,
      periodEnd: d,
      narrative,
      output: { flags: [], nextPrompts: [] },
      promptVersion: "demo-seed",
      createdAt: evening(d),
    });
    for (const [leaf, c] of changes) {
      const delta = round(Math.max(-3, Math.min(3, c.delta)));
      if (Math.abs(delta) < 0.01) continue;
      values.set(leaf, values.get(leaf)! + delta);
      events.push({
        nodeId: nodeId.get(leaf)!,
        seasonId,
        delta,
        source: "daily_recap",
        reason: c.reason,
        evidence: { quote: c.evidence },
        recapId,
        createdAt: evening(d),
      });
    }

    // Every few days the scout leaves questions for the next day.
    if (!flu && rand() < 0.35) {
      pendingPrompts.set(addDays(d, 1), [
        {
          question: pick([
            "How many hours did you sleep last night?",
            "Did you get any strength work in yesterday?",
            "Have you made plans with friends this week?",
          ]),
          answer: null,
        },
      ]);
    }
    logs.push({
      userId,
      localDate: d,
      journal: notes.join(" "),
      prompts: answered,
      status: "recapped",
    });
  }
  // Today: questions waiting, nothing logged yet, so End my day can be tried.
  logs.push({
    userId,
    localDate: today,
    journal: "",
    prompts: [{ question: "Did you get a run in this morning?", answer: null }],
    status: "open",
  });

  for (let i = 0; i < entries.length; i += 200)
    await db.insert(habitEntries).values(entries.slice(i, i + 200));
  await db.insert(dayLogs).values(logs);
  await db.insert(recaps).values(recapRows);
  for (let i = 0; i < events.length; i += 200)
    await db.insert(ratingEvents).values(events.slice(i, i + 200));

  // Weekly reviews for every finished week since onboarding.
  const latest = lastCompletedWeek(today, 1);
  const weeks: { start: string; end: string }[] = [];
  for (let end = latest.end; end >= start; end = addDays(end, -7))
    weeks.unshift({ start: addDays(end, -6), end });
  const habitDone = (name: string, from: string, to: string) =>
    entries.filter(
      (e) => e.habitId === habitIds.get(name) && e.localDate >= from && e.localDate <= to,
    ).length;
  for (const [i, week] of weeks.entries()) {
    const last = i === weeks.length - 1;
    const flu =
      isFlu(week.start) || isFlu(week.end) || (fluStart >= week.start && fluStart <= week.end);
    const runs = habitDone("Morning run", week.start, week.end);
    const gyms = habitDone("Gym", week.start, week.end);
    const recapId = crypto.randomUUID();
    const allNodes = nodeRows.map((n) => ({
      id: n.id!,
      parentId: n.parentId ?? null,
      depth: n.depth,
      weight: n.weight ?? 1,
    }));
    const leafNow = new Map([...values].map(([name, v]) => [nodeId.get(name)!, v]));
    const rolled = computeNodeValues(allNodes, leafNow);
    const projection = (id: string, push: number) =>
      round(Math.min(100, (rolled.get(id) ?? 50) + push), 1);
    await db.insert(recaps).values({
      id: recapId,
      userId,
      seasonId,
      kind: "weekly",
      periodStart: week.start,
      periodEnd: week.end,
      narrative: flu
        ? `The flu took out the middle of the week, and decay was paused for it. You still got ${runs} run${runs === 1 ? "" : "s"} in around it. Career work held steady; social time was the casualty.`
        : `${runs} runs and ${gyms} gym session${gyms === 1 ? "" : "s"} this week. Deep work stayed consistent and the mentoring session happened. ${runs >= 3 ? "Endurance is trending the right way for the half marathon." : "Running dipped below plan."} Close friends remain the gap you flagged.`,
      output: {
        focusGoals: [
          {
            title: "Two gym sessions",
            detail: "Tuesday and Thursday, 45 minutes each.",
            nodeIds: [nodeId.get("Strength")!],
          },
          {
            title: "One plan with friends",
            detail: "Book it by Wednesday and keep it.",
            nodeIds: [nodeId.get("Close Friends")!],
          },
          {
            title: "Long run on Saturday",
            detail: "Build to 60 minutes at an easy pace.",
            nodeIds: [nodeId.get("Endurance")!],
          },
        ],
        habitProposals: last
          ? [
              {
                index: 0,
                name: "See a friend",
                type: "checkbox",
                days: [5, 6],
                target: null,
                unit: null,
                nodeIds: [nodeId.get("Close Friends")!],
                reason:
                  "Close friends is your lowest attribute; a weekend check-in makes it concrete.",
                status: "pending",
              },
            ]
          : [],
        decayRevisions: [],
        projections: [
          { nodeId: rootId, value: projection(rootId, 2.5) },
          ...TREE.map((c) => ({
            nodeId: nodeId.get(c.name)!,
            value: projection(nodeId.get(c.name)!, c.name === "Fitness" ? 4 : 2),
          })),
        ],
        archetypeChange: null,
      },
      promptVersion: "demo-seed",
      createdAt: new Date(`${addDays(week.end, 1)}T10:00:00Z`),
    });
    if (i === 0 && weeks.length > 1) {
      await db.insert(userBadges).values({
        userId,
        seasonId,
        kind: "personal",
        badgeKey: `personal-${recapId}`,
        name: "Dawn Patrol",
        description: "Ran before work on every scheduled morning of your first week.",
        recapId,
        earnedAt: new Date(`${addDays(week.end, 1)}T10:00:00Z`),
      });
    }
  }

  await seedRoutine(db, userId, start, yesterday, isFlu);

  // Let the app's own engines fill in decay and catalog badges.
  const decayed = await applyDecay(db, userId);
  const badges = await awardBadges(db, userId);
  await db.update(users).set({ profileVisibility: "friends" }).where(eq(users.id, userId));
  await getRatings(db, userId); // writes the demo player's shared card
  await seedRivals(db, userId, season);

  const events2 = await db.select().from(ratingEvents).where(eq(ratingEvents.seasonId, seasonId));
  const finalValues = computeNodeValues(
    nodeRows.map((n) => ({
      id: n.id!,
      parentId: n.parentId ?? null,
      depth: n.depth,
      weight: n.weight ?? 1,
    })),
    leafValuesFromEvents(events2.filter((e) => !e.voidedAt)),
  );
  console.log(
    [
      `Seeded "${DEMO_NAME}" (${season.label}, onboarded ${start}):`,
      `  ${logs.length - 1} logged days, ${recapRows.length} daily recaps, ${weeks.length} weekly reviews, ${entries.length} habit entries`,
      `  ${decayed} days of decay applied, ${badges.length} catalog badges earned`,
      `  Overall ${finalValues.get(rootId)?.toFixed(1)} (started ${computeNodeValues(
        nodeRows.map((n) => ({
          id: n.id!,
          parentId: n.parentId ?? null,
          depth: n.depth,
          weight: n.weight ?? 1,
        })),
        new Map(leaves.map((l) => [nodeId.get(l.name)!, l.start])),
      )
        .get(rootId)
        ?.toFixed(1)}); previous season ${previous.label} card at ${prevOverall}`,
      `Sign in with the demo credentials in apps/api/scripts/seed-demo.ts, or use dev user "${DEMO_USERNAME}".`,
    ].join("\n"),
  );
}

/** Last quarter: same tree, starting a little lower, moved week by week to its final values. */
async function seedPreviousSeason(
  db: ReturnType<typeof createNeonDb>["db"],
  userId: string,
  period: { label: string; startsOn: string; endsOn: string },
  lineageOf: (name: string) => string,
): Promise<number> {
  const r = mulberry32(20260701);
  const [season] = await db
    .insert(seasons)
    .values({
      userId,
      ...period,
      status: "archived",
      archetype: "Steady Generalist",
      archetypeDescription: "Even across the board, with no standout strength yet.",
    })
    .returning({ id: seasons.id });
  const seasonId = season!.id;

  const rootId = crypto.randomUUID();
  const rows: (typeof ratingNodes.$inferInsert)[] = [
    {
      id: rootId,
      seasonId,
      userId,
      parentId: null,
      lineageId: lineageOf("Overall"),
      name: "Overall",
      depth: 0,
    },
  ];
  const leafId = new Map<string, string>();
  TREE.forEach((c, ci) => {
    const catId = crypto.randomUUID();
    rows.push({
      id: catId,
      seasonId,
      userId,
      parentId: rootId,
      lineageId: lineageOf(c.name),
      name: c.name,
      description: c.description,
      depth: 1,
      weight: c.weight,
      sortOrder: ci,
      templateKey: c.templateKey,
    });
    c.leaves.forEach((l, li) => {
      const id = crypto.randomUUID();
      leafId.set(l.name, id);
      rows.push({
        id,
        seasonId,
        userId,
        parentId: catId,
        lineageId: lineageOf(l.name),
        name: l.name,
        description: l.description,
        depth: 2,
        weight: l.weight,
        sortOrder: li,
      });
    });
  });
  await db.insert(ratingNodes).values(rows);
  const leaves = TREE.flatMap((c) => c.leaves);

  // Started a bit below where it finished; onboarding on the first day.
  const startValue = new Map(leaves.map((l) => [l.name, round(l.previous - 1 - r() * 4, 1)]));
  await db.insert(ratingEvents).values(
    leaves.map((l) => ({
      nodeId: leafId.get(l.name)!,
      seasonId,
      delta: startValue.get(l.name)!,
      source: "onboarding" as const,
      reason: `Starting rating from your scouting report for ${l.name.toLowerCase()}.`,
      evidence: { confidence: "medium" },
      createdAt: new Date(`${period.startsOn}T15:00:00Z`),
    })),
  );

  // Most days logged, each with a one-line recap.
  const logs: (typeof dayLogs.$inferInsert)[] = [];
  const dailies: (typeof recaps.$inferInsert)[] = [];
  for (let d = addDays(period.startsOn, 1); d <= period.endsOn; d = addDays(d, 1)) {
    if (r() > 0.72) continue;
    const journal = LIFE_NOTES[Math.floor(r() * LIFE_NOTES.length)]!;
    logs.push({ userId, localDate: d, journal, status: "recapped", updatedAt: evening(d) });
    dailies.push({
      userId,
      seasonId,
      kind: "daily",
      periodStart: d,
      periodEnd: d,
      narrative: journal,
      output: { flags: [], nextPrompts: [] },
      promptVersion: "demo-seed",
      createdAt: evening(d),
    });
  }
  await db.insert(dayLogs).values(logs);
  for (let i = 0; i < dailies.length; i += 200)
    await db.insert(recaps).values(dailies.slice(i, i + 200));

  // Weekly reviews carry the season's movement, landing exactly on the final card.
  const weeks: { start: string; end: string }[] = [];
  for (let end = addDays(period.startsOn, 6); end <= period.endsOn; end = addDays(end, 7)) {
    weeks.push({ start: addDays(end, -6), end });
  }
  const NARRATIVES = [
    "A steady week: most days logged and nothing slipped badly.",
    "Work ran long; workouts were the casualty. Logging stayed consistent.",
    "Good balance this week, with a couple of social plans kept.",
    "Quiet week. Small gains across the board, no big moves.",
  ];
  const now = new Map(startValue);
  for (const [i, week] of weeks.entries()) {
    const recapId = crypto.randomUUID();
    const left = weeks.length - i;
    const deltas = leaves
      .map((l) => {
        const remaining = l.previous - now.get(l.name)!;
        const delta = left === 1 ? remaining : remaining / left + (r() - 0.5) * 0.6;
        return { l, delta: round(delta, 2) };
      })
      .filter((d) => Math.abs(d.delta) >= 0.01);
    await db.insert(recaps).values({
      id: recapId,
      userId,
      seasonId,
      kind: "weekly",
      periodStart: week.start,
      periodEnd: week.end,
      narrative: NARRATIVES[Math.floor(r() * NARRATIVES.length)]!,
      output: {
        focusGoals: [],
        habitProposals: [],
        decayRevisions: [],
        projections: [],
        archetypeChange: null,
      },
      promptVersion: "demo-seed",
      createdAt: new Date(`${addDays(week.end, 1)}T10:00:00Z`),
    });
    await db.insert(ratingEvents).values(
      deltas.map(({ l, delta }) => ({
        nodeId: leafId.get(l.name)!,
        seasonId,
        delta,
        source: "weekly_review" as const,
        reason:
          delta >= 0
            ? `Consistent work on ${l.name.toLowerCase()}.`
            : `${l.name} slipped this week.`,
        recapId,
        createdAt: new Date(`${addDays(week.end, 1)}T10:00:00Z`),
      })),
    );
    for (const { l, delta } of deltas) now.set(l.name, round(now.get(l.name)! + delta, 2));
  }

  // The frozen card, rolled up from the final values exactly as rollover would.
  const values = computeNodeValues(
    rows.map((n) => ({
      id: n.id!,
      parentId: n.parentId ?? null,
      depth: n.depth,
      weight: n.weight ?? 1,
    })),
    new Map(leaves.map((l) => [leafId.get(l.name)!, now.get(l.name)!])),
  );
  const overall = round(values.get(rootId) ?? 0);
  await db
    .update(seasons)
    .set({
      finalSnapshot: {
        overall,
        archetype: "Steady Generalist",
        nodes: rows.map((n) => ({
          id: n.id!,
          lineageId: n.lineageId!,
          parentId: n.parentId ?? null,
          name: n.name,
          depth: n.depth,
          value: values.get(n.id!) ?? null,
        })),
      },
    })
    .where(eq(seasons.id, seasonId));
  return overall;
}

/** A habit group: three morning sub-habits, done when at least two are. */
async function seedRoutine(
  db: ReturnType<typeof createNeonDb>["db"],
  userId: string,
  start: string,
  yesterday: string,
  isFlu: (date: string) => boolean,
) {
  const r = mulberry32(20261001);
  const days = [1, 2, 3, 4, 5];
  const [group] = await db
    .insert(habits)
    .values({
      userId,
      name: "Morning routine",
      type: "group",
      config: normalizeHabitConfig("group", { rule: "count", target: 2 }),
      days,
      startsOn: start,
      sortOrder: HABITS.length,
    })
    .returning({ id: habits.id });
  const subs = [
    { name: "Make bed", type: "checkbox" as const, config: {}, rate: 0.85, amount: null },
    {
      name: "Meditate",
      type: "duration" as const,
      config: { target: 10 },
      rate: 0.5,
      amount: [10, 20],
    },
    {
      name: "Water first thing",
      type: "counter" as const,
      config: { target: 2, unit: "glasses" },
      rate: 0.7,
      amount: [2, 3],
    },
  ];
  const ids = await db
    .insert(habits)
    .values(
      subs.map((h, i) => ({
        userId,
        name: h.name,
        type: h.type,
        config: normalizeHabitConfig(h.type, h.config),
        days,
        startsOn: start,
        parentId: group!.id,
        sortOrder: HABITS.length + 1 + i,
      })),
    )
    .returning({ id: habits.id });
  const entries: (typeof habitEntries.$inferInsert)[] = [];
  for (let d = addDays(start, 1); d <= yesterday; d = addDays(d, 1)) {
    if (!days.includes(dayOfWeek(d))) continue;
    subs.forEach((h, i) => {
      if (r() >= (isFlu(d) ? 0.1 : h.rate)) return;
      const value = h.amount ? Math.round(h.amount[0]! + r() * (h.amount[1]! - h.amount[0]!)) : 1;
      entries.push({ habitId: ids[i]!.id, localDate: d, valueNum: value });
    });
  }
  if (entries.length) await db.insert(habitEntries).values(entries);
}

async function seedRivals(
  db: ReturnType<typeof createNeonDb>["db"],
  demoUserId: string,
  season: { label: string; startsOn: string; endsOn: string },
) {
  await db.delete(users).where(like(users.email, `%@${RIVAL_EMAIL_DOMAIN}`));
  for (const r of RIVALS) {
    const [user] = await db
      .insert(users)
      .values({
        email: `${r.username}@${RIVAL_EMAIL_DOMAIN}`,
        username: r.username,
        displayName: r.name,
        timezone: TIMEZONE,
        profileVisibility: r.visibility,
        leaderboardOptIn: r.visibility === "public",
      })
      .returning({ id: users.id });
    // "setup" keeps them out of the hourly job, which only visits active seasons.
    const [rivalSeason] = await db
      .insert(seasons)
      .values({ userId: user!.id, ...season, status: "setup", archetype: r.archetype })
      .returning({ id: seasons.id });
    const categories = r.categories.map(([name, templateKey, value]) => ({
      name,
      templateKey,
      value,
    }));
    const values = categories.map((c) => c.value);
    await db.insert(playerCards).values({
      userId: user!.id,
      seasonId: rivalSeason!.id,
      seasonLabel: season.label,
      overall: round(values.reduce((a, b) => a + b, 0) / values.length),
      archetype: r.archetype,
      categories,
      recappedDays: r.recappedDays,
    });
    if (r.link === "friends") {
      await db.insert(friendships).values({
        requesterId: user!.id,
        addresseeId: demoUserId,
        status: "accepted",
        respondedAt: new Date(),
      });
    } else if (r.link === "incoming") {
      await db.insert(friendships).values({ requesterId: user!.id, addresseeId: demoUserId });
    }
  }
  console.log(
    `Seeded ${RIVALS.length} rival players (${RIVALS.map((r) => `${r.username}: ${r.link}`).join(", ")})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
