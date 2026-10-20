/** A rating node as shown to the model: short refs instead of UUIDs (fewer tokens, fewer copy errors). */
export interface PromptNode {
  ref: string;
  parentRef: string | null;
  name: string;
  description: string;
  /** Current rating, when the prompt needs it. */
  value?: number;
}

export function refsFor<T extends { id: string; parentId: string | null }>(nodes: T[]) {
  const nonRoot = nodes.filter((n) => n.parentId !== null);
  const refById = new Map(nonRoot.map((n, i) => [n.id, `n${i + 1}`]));
  const idByRef = new Map([...refById].map(([id, ref]) => [ref, id]));
  return { refById, idByRef };
}

export function toPromptNodes<
  T extends { id: string; parentId: string | null; name: string; description: string },
>(nodes: T[], refById: Map<string, string>, values?: ReadonlyMap<string, number>): PromptNode[] {
  return nodes
    .filter((n) => refById.has(n.id))
    .map((n) => ({
      ref: refById.get(n.id)!,
      parentRef: (n.parentId && refById.get(n.parentId)) ?? null,
      name: n.name,
      description: n.description,
      ...(values?.has(n.id) && { value: values.get(n.id)! }),
    }));
}

/**
 * Indented outline of the tree, depth-first so each node sits directly under its parent:
 * "- [n1] Fitness" / "  - [n3] Cardio — Endurance".
 */
export function renderTree(nodes: PromptNode[], markLeaves = false): string {
  const childrenOf = (ref: string | null) => nodes.filter((n) => n.parentRef === ref);
  const lines: string[] = [];
  const visit = (node: PromptNode, depth: number) => {
    const children = childrenOf(node.ref);
    const desc = node.description ? ` — ${node.description}` : "";
    const leaf = markLeaves && children.length === 0 ? " (rated attribute)" : "";
    const value = node.value === undefined ? "" : `: ${node.value.toFixed(1)}`;
    lines.push(`${"  ".repeat(depth)}- [${node.ref}] ${node.name}${value}${desc}${leaf}`);
    for (const child of children) visit(child, depth + 1);
  };
  for (const top of childrenOf(null)) visit(top, 0);
  return lines.join("\n");
}
