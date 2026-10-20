import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    voidedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.nodeId), index().on(t.seasonId)],
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
