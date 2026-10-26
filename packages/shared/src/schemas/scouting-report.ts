import { z } from "zod";
import { MAX_NODE_NAME_LENGTH } from "../constants";

/**
 * The Scouting Report (DESIGN.md §5.8): a structured picture of what the player wants out of
 * life, what matters most, what they're focused on now and what limits them. The scout keeps it
 * current in weekly reviews, the player can edit it, and it is what the rating tree is measured
 * against when weights shift or tree changes are proposed.
 */

export const MAX_ASPIRATIONS = 6;
export const MAX_PRIORITIES = 10;
export const MAX_REPORT_FOCUSES = 5;
export const MAX_CONSTRAINTS = 5;
export const MAX_REPORT_LINE = 160;
export const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5] as const;
export const IMPORTANCE_LABELS: Record<number, string> = {
  1: "Nice to have",
  2: "Minor",
  3: "Matters",
  4: "Major",
  5: "Core",
};

export interface ScoutingPriority {
  /** A life area in the player's words, e.g. "Health", "Being a present parent". */
  area: string;
  /** 1 (nice to have) – 5 (core). */
  importance: number;
  /** The rating node lineage this area maps to, or null when the tree doesn't cover it. */
  lineageId: string | null;
  note: string;
}

/** What `users.scouting_report` stores. */
export interface ScoutingReport {
  aspirations: string[];
  priorities: ScoutingPriority[];
  focuses: string[];
  constraints: string[];
  updatedAt: string | null;
  updatedBy: "scout" | "user" | null;
}

const line = z
  .string()
  .transform((s) => s.trim().slice(0, MAX_REPORT_LINE))
  .catch("");
const lines = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .map((i) => line.parse(i))
        .filter(Boolean)
        .slice(0, max),
    );

const storedPriority = z.object({
  area: z
    .string()
    .trim()
    .min(1)
    .max(MAX_NODE_NAME_LENGTH * 2),
  importance: z.number().int().min(1).max(5).catch(3),
  lineageId: z.string().nullable().catch(null),
  note: line,
});

const storedSchema = z.object({
  aspirations: lines(MAX_ASPIRATIONS),
  priorities: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .map((i) => storedPriority.safeParse(i))
        .flatMap((r) => (r.success ? [r.data] : []))
        .slice(0, MAX_PRIORITIES),
    ),
  focuses: lines(MAX_REPORT_FOCUSES),
  constraints: lines(MAX_CONSTRAINTS),
  updatedAt: z.string().nullable().catch(null),
  updatedBy: z.enum(["scout", "user"]).nullable().catch(null),
});

/** Reads a stored document (or anything else) into a complete report; bad parts are dropped. */
export function parseScoutingReport(raw: unknown): ScoutingReport {
  return storedSchema.parse(raw && typeof raw === "object" ? raw : {});
}

export const EMPTY_SCOUTING_REPORT: ScoutingReport = parseScoutingReport({});

export const isScoutingReportEmpty = (r: ScoutingReport) =>
  !r.aspirations.length && !r.priorities.length && !r.focuses.length && !r.constraints.length;

/** As served: priorities resolved to the current season's nodes. */
export interface ScoutingReportDto extends Omit<ScoutingReport, "priorities"> {
  priorities: (Omit<ScoutingPriority, "lineageId"> & {
    nodeId: string | null;
    nodeName: string | null;
  })[];
}

/** PUT /scouting-report: the player's own edit, replacing the whole report. */
export const scoutingReportBodySchema = z.object({
  aspirations: z.array(z.string().trim().min(1).max(MAX_REPORT_LINE)).max(MAX_ASPIRATIONS),
  priorities: z
    .array(
      z.object({
        area: z
          .string()
          .trim()
          .min(1)
          .max(MAX_NODE_NAME_LENGTH * 2),
        importance: z.number().int().min(1).max(5),
        nodeId: z.uuid().nullable(),
        note: z.string().trim().max(MAX_REPORT_LINE).default(""),
      }),
    )
    .max(MAX_PRIORITIES),
  focuses: z.array(z.string().trim().min(1).max(MAX_REPORT_LINE)).max(MAX_REPORT_FOCUSES),
  constraints: z.array(z.string().trim().min(1).max(MAX_REPORT_LINE)).max(MAX_CONSTRAINTS),
});
export type ScoutingReportBody = z.infer<typeof scoutingReportBodySchema>;

/** The report as the model writes it (refs instead of ids). */
export const scoutingReportOutputSchema = z.object({
  aspirations: z
    .array(z.string())
    .describe(`Up to ${MAX_ASPIRATIONS} things they want out of life, in their terms`),
  priorities: z
    .array(
      z.object({
        area: z.string().describe("A life area in the user's words"),
        importance: z.number().describe("1 nice to have, 3 matters, 5 core"),
        ref: z
          .string()
          .nullable()
          .describe("The tree node ref that measures this area, or null if the tree has none"),
        note: z.string().describe("Why it matters to them, one short line"),
      }),
    )
    .describe(`Up to ${MAX_PRIORITIES} life areas, most important first`),
  focuses: z
    .array(z.string())
    .describe(`Up to ${MAX_REPORT_FOCUSES} things they're working on now`),
  constraints: z
    .array(z.string())
    .describe(`Up to ${MAX_CONSTRAINTS} limits: schedule, injuries, money, caregiving`),
});
