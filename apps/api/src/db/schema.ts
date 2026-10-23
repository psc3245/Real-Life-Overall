import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Column names are mapped to snake_case by the `casing` option (see db/client.ts, drizzle.config.ts).

const id = () => uuid().primaryKey().defaultRandom();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const rating = () => numeric({ precision: 5, scale: 2, mode: "number" });

/** Postgres full-text search vector; used for long-term memory retrieval (DESIGN.md §5.5). */
const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const profileVisibility = pgEnum("profile_visibility", ["private", "friends", "public"]);

export const users = pgTable("users", {
  id: id(),
  email: text().notNull().unique(),
  username: text().notNull().unique(),
  displayName: text().notNull(),
  timezone: text().notNull().default("UTC"),
  /** 0 = Sunday … 6 = Saturday */
  weekStart: smallint().notNull().default(1),
  /** Subject id from the auth provider, once one is chosen (DESIGN.md §8.5). */
  authSubject: text().unique(),
  /** Rolling LLM-maintained profile, refreshed by weekly reviews and fed to every prompt. */
  profileSummary: text(),
  /** Who can see the player card (DESIGN.md §7.3). */
  profileVisibility: profileVisibility().notNull().default("private"),
  /** Appear on global leaderboards (also needs a public profile). */
  leaderboardOptIn: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const seasonStatus = pgEnum("season_status", ["setup", "active", "archived"]);

export const seasons = pgTable(
  "seasons",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    status: seasonStatus().notNull().default("setup"),
    archetype: text(),
    archetypeDescription: text(),
    /** SeasonCardDto content, frozen when the season is archived. */
    finalSnapshot: jsonb(),
    /** Seasons started by rollover can have their tree edited until this date. */
    setupEndsOn: date(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.userId, t.label)],
);

export const ratingNodes = pgTable(
  "rating_nodes",
  {
    id: id(),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: uuid().references((): AnyPgColumn => ratingNodes.id, { onDelete: "cascade" }),
    /** Links "the same" node across seasons for long-term history. */
    lineageId: uuid().notNull().defaultRandom(),
    name: text().notNull(),
    description: text().notNull().default(""),
    depth: smallint().notNull(),
    weight: numeric({ precision: 8, scale: 4, mode: "number" }).notNull().default(1),
    sortOrder: integer().notNull().default(0),
    templateKey: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.seasonId),
    check("rating_nodes_depth_range", sql`${t.depth} between 0 and 3`),
    check("rating_nodes_weight_positive", sql`${t.weight} > 0`),
  ],
);

export const ratingEventSource = pgEnum("rating_event_source", [
  "onboarding",
  "daily_recap",
  "weekly_review",
  "decay",
  "recalibration",
]);

/** Append-only ledger: a leaf's value is the clamped sum of its non-voided deltas. */
export const ratingEvents = pgTable(
  "rating_events",
  {
    id: id(),
    nodeId: uuid()
      .notNull()
      .references(() => ratingNodes.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    delta: numeric({ precision: 6, scale: 2, mode: "number" }).notNull(),
    source: ratingEventSource().notNull(),
    reason: text().notNull(),
    evidence: jsonb(),
    /** The recap that produced this change; re-running a recap voids its events. */
    recapId: uuid().references((): AnyPgColumn => recaps.id, { onDelete: "set null" }),
    /** The nightly decay run that produced this change. */
    decayRunId: uuid().references((): AnyPgColumn => decayRuns.id, { onDelete: "set null" }),
    voidedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.nodeId), index().on(t.seasonId), index().on(t.recapId)],
);

export const recapKind = pgEnum("recap_kind", ["daily", "weekly"]);
export const recapStatus = pgEnum("recap_status", ["active", "superseded"]);

export const recaps = pgTable(
  "recaps",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    kind: recapKind().notNull(),
    periodStart: date().notNull(),
    periodEnd: date().notNull(),
    narrative: text().notNull(),
    narrativeSearch: tsvector().generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${recaps.narrative})`,
    ),
    /** The normalized LLM output (flags, prompts, raw reasons). */
    output: jsonb().notNull(),
    promptVersion: text().notNull(),
    status: recapStatus().notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [
    // At most one current recap per period; re-runs supersede the old one.
    uniqueIndex("recaps_one_active_per_period")
      .on(t.userId, t.kind, t.periodStart)
      .where(sql`${t.status} = 'active'`),
    index("recaps_narrative_search").using("gin", t.narrativeSearch),
  ],
);

export const decayAuthor = pgEnum("decay_author", ["llm", "user"]);

export const decayRules = pgTable(
  "decay_rules",
  {
    id: id(),
    nodeId: uuid()
      .notNull()
      .references(() => ratingNodes.id, { onDelete: "cascade" }),
    graceDays: smallint().notNull(),
    perDay: numeric({ precision: 4, scale: 2, mode: "number" }).notNull(),
    floor: rating().notNull(),
    notes: text().notNull().default(""),
    version: integer().notNull().default(1),
    active: boolean().notNull().default(true),
    authoredBy: decayAuthor().notNull().default("llm"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.nodeId)],
);

export const goals = pgTable(
  "goals",
  {
    id: id(),
    nodeId: uuid()
      .notNull()
      .references(() => ratingNodes.id, { onDelete: "cascade" }),
    targetValue: rating().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.nodeId)],
);

export const onboardingStage = pgEnum("onboarding_stage", [
  "discovery",
  "tree",
  "weights",
  "questionnaire",
  "followup",
  "rating",
  "complete",
]);

export const onboardingSessions = pgTable(
  "onboarding_sessions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    // New sessions start at "discovery" (set by the repo); the column default stays "tree"
    // because a migration can't use an enum value it adds in the same transaction.
    stage: onboardingStage().notNull().default("tree"),
    /** What matters to the user: summarized from discovery, or typed on the weights step. */
    priorities: text(),
    /** ChatMessageDto[] of the discovery conversation. */
    discovery: jsonb(),
    /** The scout's explanation of the tree it drafted. */
    templateRationale: text(),
    /** The LLM's explanation of its proposed weights, shown on the weights step. */
    weightRationale: text(),
    questionnaire: jsonb(),
    answers: jsonb(),
    chat: jsonb(),
    result: jsonb(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.seasonId)],
);

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    purpose: text().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    promptVersion: text().notNull(),
    inputTokens: integer(),
    outputTokens: integer(),
    costUsd: numeric({ precision: 10, scale: 6, mode: "number" }),
    latencyMs: integer().notNull(),
    error: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);

/** open: never recapped. recapped: recap is current. stale: edited since its recap. */
export const dayStatus = pgEnum("day_status", ["open", "recapped", "stale"]);

/** One row per user per local date that has any logged content. */
export const dayLogs = pgTable(
  "day_logs",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: date().notNull(),
    journal: text().notNull().default(""),
    journalSearch: tsvector().generatedAlwaysAs(
      (): SQL => sql`to_tsvector('english', ${dayLogs.journal})`,
    ),
    /** GuidedPromptDto[] written by the previous day's recap. */
    prompts: jsonb().notNull().default([]),
    status: dayStatus().notNull().default("open"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.userId, t.localDate),
    index("day_logs_journal_search").using("gin", t.journalSearch),
  ],
);

export const habitType = pgEnum("habit_type", [
  "checkbox",
  "checknote",
  "counter",
  "duration",
  "slider",
  "rating",
  "shorttext",
  "journal",
  "group",
]);

export const habits = pgTable(
  "habits",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: habitType().notNull(),
    /** HabitConfig from @rlo/shared, normalized per type. */
    config: jsonb().notNull(),
    /** Scheduled weekdays, 0 = Sunday. */
    days: smallint().array().notNull(),
    /** First local date the habit counts; may be backdated. */
    startsOn: date()
      .notNull()
      .default(sql`CURRENT_DATE`),
    sortOrder: integer().notNull().default(0),
    /** The group this is a sub-habit of (habits of type "group"). */
    parentId: uuid().references((): AnyPgColumn => habits.id, { onDelete: "cascade" }),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId), index().on(t.parentId)],
);

/** Links survive seasons by pointing at a node lineage rather than a season's node row. */
export const habitLinks = pgTable(
  "habit_links",
  {
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    nodeLineageId: uuid().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex().on(t.habitId, t.nodeLineageId)],
);

export const habitEntries = pgTable(
  "habit_entries",
  {
    id: id(),
    habitId: uuid()
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    localDate: date().notNull(),
    valueNum: numeric({ precision: 10, scale: 2, mode: "number" }),
    valueText: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.habitId, t.localDate)],
);

/**
 * Marks a user's local date as decayed. Backfilled activity voids runs from that date on so
 * they can be recomputed.
 */
export const decayRuns = pgTable(
  "decay_runs",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    localDate: date().notNull(),
    paused: boolean().notNull().default(false),
    voidedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("decay_runs_one_active_per_day")
      .on(t.userId, t.localDate)
      .where(sql`${t.voidedAt} is null`),
  ],
);

export const pauses = pgTable(
  "pauses",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startsOn: date().notNull(),
    /** Null while open-ended. */
    endsOn: date(),
    reason: text().notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

// Better Auth tables (DESIGN.md §8.5). Kept separate from `users`: an app user is linked to its
// auth identity via users.auth_subject, so the domain model doesn't depend on the auth library.

export const authUsers = pgTable("auth_users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    /** Password hash for email/password accounts. */
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.userId)],
);

export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.identifier)],
);

export const badgeKind = pgEnum("badge_kind", ["catalog", "personal"]);
export const badgeTier = pgEnum("badge_tier", ["bronze", "silver", "gold", "hof"]);

/**
 * Earned badges (DESIGN.md §7.1). Catalog badges have one row per tier reached; personal
 * badges are awarded by weekly reviews and have no tier.
 */
export const userBadges = pgTable(
  "user_badges",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid().references(() => seasons.id, { onDelete: "set null" }),
    kind: badgeKind().notNull(),
    badgeKey: text().notNull(),
    tier: badgeTier(),
    name: text().notNull(),
    description: text().notNull(),
    /** The recap (daily or weekly) that earned it, for "new badge" moments. */
    recapId: uuid().references(() => recaps.id, { onDelete: "set null" }),
    earnedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("user_badges_one_per_tier").on(t.userId, t.badgeKey, t.tier),
    index().on(t.recapId),
  ],
);

/**
 * The shareable slice of each player's current ratings (PublicCardDto), so profiles and
 * leaderboards don't replay other users' ledgers. Refreshed whenever the owner's ratings are
 * read and by the hourly job.
 */
export const playerCards = pgTable(
  "player_cards",
  {
    userId: uuid()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    seasonLabel: text().notNull(),
    overall: rating().notNull(),
    archetype: text(),
    /** PublicCategoryDto[] */
    categories: jsonb().notNull(),
    recappedDays: integer().notNull().default(0),
    /** Recapped days where the model flagged implausible or ambiguous claims. Owner-only. */
    flaggedDays: integer().notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.seasonLabel, t.overall)],
);

export const friendshipStatus = pgEnum("friendship_status", ["pending", "accepted"]);

/** One row per pair of players: a pending request (requester → addressee) or a friendship. */
export const friendships = pgTable(
  "friendships",
  {
    id: id(),
    requesterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addresseeId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendshipStatus().notNull().default("pending"),
    createdAt: createdAt(),
    respondedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // Either direction counts as the same pair.
    uniqueIndex("friendships_pair").on(
      sql`least(${t.requesterId}, ${t.addresseeId})`,
      sql`greatest(${t.requesterId}, ${t.addresseeId})`,
    ),
    index().on(t.requesterId),
    index().on(t.addresseeId),
    check("friendships_not_self", sql`${t.requesterId} <> ${t.addresseeId}`),
  ],
);
