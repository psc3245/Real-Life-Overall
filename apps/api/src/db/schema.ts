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
    stage: onboardingStage().notNull().default("tree"),
    /** Free-text priorities the user gives when weighting categories. */
    priorities: text(),
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
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
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
