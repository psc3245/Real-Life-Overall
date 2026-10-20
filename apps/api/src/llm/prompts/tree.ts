/** A rating node as shown to the model: short refs instead of UUIDs (fewer tokens, fewer copy errors). */
export interface PromptNode {
  ref: string;
  parentRef: string | null;
  name: string;
  description: string;
}

export function refsFor<T extends { id: string; parentId: string | null }>(nodes: T[]) {
  const nonRoot = nodes.filter((n) => n.parentId !== null);
  const refById = new Map(nonRoot.map((n, i) => [n.id, `n${i + 1}`]));
  const idByRef = new Map([...refById].map(([id, ref]) => [ref, id]));
  return { refById, idByRef };
}

export function toPromptNodes<
  T extends { id: string; parentId: string | null; name: string; description: string },
>(nodes: T[], refById: Map<string, string>): PromptNode[] {
  return nodes
    .filter((n) => refById.has(n.id))
    .map((n) => ({
      ref: refById.get(n.id)!,
      parentRef: (n.parentId && refById.get(n.parentId)) ?? null,
      name: n.name,
      description: n.description,
    }));
}

/** Indented outline of the tree, e.g. "- [n1] Fitness" / "  - [n3] Cardio — Endurance". */
export function renderTree(nodes: PromptNode[], markLeaves = false): string {
  const parents = new Set(nodes.map((n) => n.parentRef));
  const depthOf = (node: PromptNode): number => {
    let depth = 0;
    let current: PromptNode | undefined = node;
    while (current?.parentRef) {
      depth += 1;
      current = nodes.find((n) => n.ref === current!.parentRef);
    }
    return depth;
  };
  return nodes
    .map((n) => {
      const desc = n.description ? ` — ${n.description}` : "";
      const leaf = markLeaves && !parents.has(n.ref) ? " (rated attribute)" : "";
      return `${"  ".repeat(depthOf(n))}- [${n.ref}] ${n.name}${desc}${leaf}`;
    })
    .join("\n");
}
