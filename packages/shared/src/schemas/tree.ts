import { z } from "zod";
import {
  DEFAULT_IMPORTANCE,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
  MAX_RATING_DEPTH,
  MAX_TREE_NODES,
} from "../constants";
import { validateTreeStructure, type RatingNodeLike } from "../rating/tree";

export const DRAFT_ROOT_KEY = "__overall__";

/**
 * A node in the tree builder. `parentKey: null` means a category directly under Overall;
 * the Overall root itself is implicit and created by the server.
 */
export const treeDraftNodeSchema = z.object({
  key: z.string().min(1).max(64),
  parentKey: z.string().min(1).max(64).nullable(),
  name: z.string().trim().min(1).max(MAX_NODE_NAME_LENGTH),
  description: z.string().trim().max(MAX_NODE_DESCRIPTION_LENGTH).default(""),
  weight: z.number().positive().max(100).default(DEFAULT_IMPORTANCE),
  templateKey: z.string().nullable().default(null),
});
export type TreeDraftNode = z.infer<typeof treeDraftNodeSchema>;

/** Converts draft nodes into RatingNodeLike with an explicit root, computing depths. */
export function draftToRatingNodes(nodes: TreeDraftNode[]): RatingNodeLike[] {
  const byKey = new Map(nodes.map((n) => [n.key, n]));
  const depthOf = (node: TreeDraftNode): number => {
    let depth = 1;
    const seen = new Set<string>();
    let current = node;
    while (current.parentKey !== null) {
      if (seen.has(current.key)) return Number.POSITIVE_INFINITY; // cycle
      seen.add(current.key);
      const parent = byKey.get(current.parentKey);
      if (!parent) return Number.NaN; // reported as unknown parent
      current = parent;
      depth += 1;
    }
    return depth;
  };

  return [
    { id: DRAFT_ROOT_KEY, parentId: null, depth: 0, weight: 1 },
    ...nodes.map((n, i) => ({
      id: n.key,
      parentId: n.parentKey ?? DRAFT_ROOT_KEY,
      depth: depthOf(n),
      weight: n.weight,
      sortOrder: i,
    })),
  ];
}

export const treeDraftSchema = z
  .object({ nodes: z.array(treeDraftNodeSchema).min(1).max(MAX_TREE_NODES) })
  .superRefine(({ nodes }, ctx) => {
    if (nodes.some((n) => n.key === DRAFT_ROOT_KEY)) {
      ctx.addIssue({ code: "custom", message: `"${DRAFT_ROOT_KEY}" is a reserved key` });
      return;
    }
    const ratingNodes = draftToRatingNodes(nodes);
    for (const n of ratingNodes) {
      if (Number.isNaN(n.depth)) {
        ctx.addIssue({ code: "custom", message: `Node ${n.id} has an unknown parent` });
        return;
      }
      if (!Number.isFinite(n.depth)) {
        ctx.addIssue({ code: "custom", message: `Node ${n.id} is part of a cycle` });
        return;
      }
      if (n.depth > MAX_RATING_DEPTH) {
        ctx.addIssue({
          code: "custom",
          message: `Node ${n.id} is nested deeper than ${MAX_RATING_DEPTH} levels`,
        });
        return;
      }
    }
    for (const message of validateTreeStructure(ratingNodes)) {
      ctx.addIssue({ code: "custom", message });
    }
  });
export type TreeDraft = z.infer<typeof treeDraftSchema>;
