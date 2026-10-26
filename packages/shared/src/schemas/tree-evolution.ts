import { z } from "zod";

/**
 * The rating tree evolves with the player (DESIGN.md §4.5): weekly reviews nudge weights in
 * small automatic steps, and now and then propose adding or removing a category or attribute,
 * which the player accepts or dismisses.
 */

/** Weight changes one weekly review may make. */
export const MAX_WEIGHT_SHIFTS = 3;
/** Largest change to one node's weight per review, as a fraction of its current weight. */
export const WEIGHT_SHIFT_CAP = 0.15;
/** A weight stays within these multiples of its season-start weight. */
export const WEIGHT_DRIFT = { min: 0.5, max: 2 } as const;

/** Days between tree change proposals (the tree should change rarely). */
export const TREE_PROPOSAL_COOLDOWN_DAYS = 28;
/** No proposals in a season's last days; season setup covers those. */
export const TREE_PROPOSAL_SEASON_END_DAYS = 14;
export const MAX_TREE_CHANGES = 3;
export const MAX_NEW_CATEGORY_ATTRIBUTES = 4;

export interface WeightChangeDto {
  id: string;
  nodeId: string;
  nodeName: string;
  /** Share of the parent, 0-100, before and after. */
  fromShare: number;
  toShare: number;
  reason: string;
  /** The weekly review that made it. */
  recapId: string | null;
  createdAt: string;
  revertedAt: string | null;
}

export interface WeightNodeDto {
  nodeId: string;
  parentId: string | null;
  name: string;
  depth: number;
  /** Share of the parent now and at season start, 0-100. */
  share: number;
  startShare: number;
}

export interface WeightsDto {
  /** Whether weekly reviews may shift weights and propose tree changes. */
  adaptive: boolean;
  nodes: WeightNodeDto[];
  changes: WeightChangeDto[];
}

export const TREE_CHANGE_KINDS = ["add_category", "add_attribute", "remove"] as const;
export type TreeChangeKind = (typeof TREE_CHANGE_KINDS)[number];

export type TreeChangeDto =
  | {
      kind: "add_category";
      name: string;
      description: string;
      attributes: { name: string; description: string }[];
    }
  | {
      kind: "add_attribute";
      parentId: string;
      parentName: string;
      name: string;
      description: string;
    }
  | { kind: "remove"; nodeId: string; nodeName: string };

export type TreeProposalStatus = "pending" | "accepted" | "dismissed" | "expired";

export interface TreeProposalDto {
  id: string;
  reason: string;
  changes: TreeChangeDto[];
  status: TreeProposalStatus;
  recapId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// LLM output (flat, so strict structured-output modes accept it)

export const weightShiftsOutputSchema = z
  .array(
    z.object({
      ref: z.string().describe("A category or attribute ref"),
      change: z
        .number()
        .describe(`Relative change to its weight, e.g. 0.1 for +10%; within ±${WEIGHT_SHIFT_CAP}`),
      reason: z.string().describe("One sentence on what this week showed about its importance"),
    }),
  )
  .describe(`At most ${MAX_WEIGHT_SHIFTS}; only on a clear, repeated signal. Usually []`);

export const treeChangeOutputSchema = z
  .object({
    reason: z.string().describe("2-3 sentences tying the change to the Scouting Report"),
    changes: z
      .array(
        z.object({
          kind: z.enum(TREE_CHANGE_KINDS),
          ref: z
            .string()
            .nullable()
            .describe("remove: the node to remove; add_attribute: its category; else null"),
          name: z.string().nullable().describe("The new node's name; null for remove"),
          description: z.string().nullable(),
          attributes: z
            .array(z.object({ name: z.string(), description: z.string() }))
            .describe(`add_category: 2-${MAX_NEW_CATEGORY_ATTRIBUTES} attributes; else []`),
        }),
      )
      .describe(`1-${MAX_TREE_CHANGES} changes`),
  })
  .nullable()
  .describe("Only when the tree clearly misses or over-weights what matters. Usually null");
