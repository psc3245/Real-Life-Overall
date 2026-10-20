import { MAX_RATING_DEPTH } from "../constants";
import { normalizeWeights, roundRating } from "./math";

/** Minimal shape shared by DB rows and client drafts. The root (Overall) has parentId null and depth 0. */
export interface RatingNodeLike {
  id: string;
  parentId: string | null;
  depth: number;
  weight: number;
  sortOrder?: number;
  archived?: boolean;
}

export type TreeNode<T extends RatingNodeLike> = T & { children: TreeNode<T>[] };

/** Returns human-readable problems with the tree's shape; empty when valid. */
export function validateTreeStructure(nodes: RatingNodeLike[]): string[] {
  const errors: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length) errors.push("Node ids must be unique");

  const roots = nodes.filter((n) => n.parentId === null);
  if (roots.length !== 1) errors.push(`Expected exactly one root, found ${roots.length}`);
  if (roots[0] && roots[0].depth !== 0) errors.push("Root must have depth 0");

  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = byId.get(node.parentId);
    if (!parent) {
      errors.push(`Node ${node.id} has unknown parent ${node.parentId}`);
      continue;
    }
    if (node.depth !== parent.depth + 1) errors.push(`Node ${node.id} has inconsistent depth`);
    if (node.depth > MAX_RATING_DEPTH) {
      errors.push(`Node ${node.id} is deeper than ${MAX_RATING_DEPTH} levels`);
    }
    if (!(node.weight > 0)) errors.push(`Node ${node.id} must have a positive weight`);
  }

  if (roots.length === 1 && nodes.length < 2) errors.push("Tree needs at least one category");
  return errors;
}

export function buildTree<T extends RatingNodeLike>(nodes: T[]): TreeNode<T> {
  const errors = validateTreeStructure(nodes);
  if (errors.length) throw new Error(`Invalid rating tree: ${errors.join("; ")}`);

  const withChildren = new Map<string, TreeNode<T>>(
    nodes.map((n) => [n.id, { ...n, children: [] }]),
  );
  let root: TreeNode<T> | undefined;
  for (const node of withChildren.values()) {
    if (node.parentId === null) root = node;
    else withChildren.get(node.parentId)!.children.push(node);
  }
  for (const node of withChildren.values()) {
    node.children.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }
  return root!;
}

function activeChildren<T extends RatingNodeLike>(node: TreeNode<T>): TreeNode<T>[] {
  return node.children.filter((c) => !c.archived);
}

/** Leaves are the only nodes that hold raw ratings; everything above is computed. */
export function leafIds(nodes: RatingNodeLike[]): string[] {
  const active = nodes.filter((n) => !n.archived);
  const parents = new Set(active.map((n) => n.parentId));
  return active.filter((n) => !parents.has(n.id) && n.parentId !== null).map((n) => n.id);
}

/**
 * Rolls leaf values up the tree: each parent is the weighted mean of its active children
 * that have a value. Parents with no valued children are left out of the result.
 */
export function computeNodeValues(
  nodes: RatingNodeLike[],
  leafValues: ReadonlyMap<string, number>,
): Map<string, number> {
  const root = buildTree(nodes);
  const values = new Map<string, number>();

  const visit = (node: TreeNode<RatingNodeLike>): number | undefined => {
    const children = activeChildren(node);
    if (children.length === 0) {
      const v = leafValues.get(node.id);
      if (v !== undefined) values.set(node.id, roundRating(v));
      return v;
    }
    const valued = children
      .map((c) => ({ value: visit(c), weight: c.weight }))
      .filter((c): c is { value: number; weight: number } => c.value !== undefined);
    if (valued.length === 0) return undefined;
    const weights = normalizeWeights(valued.map((c) => c.weight));
    const value = valued.reduce((sum, c, i) => sum + c.value * weights[i]!, 0);
    values.set(node.id, roundRating(value));
    return value;
  };

  visit(root);
  return values;
}
