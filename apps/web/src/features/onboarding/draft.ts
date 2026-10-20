import {
  DEFAULT_IMPORTANCE,
  type CategoryTemplate,
  type RatingNodeDto,
  type TreeDraftNode,
} from "@rlo/shared";

export type Draft = TreeDraftNode[];

const newKey = () => crypto.randomUUID();

/** Server nodes → editable draft. Children of Overall become top-level (parentKey null). */
export function nodesToDraft(nodes: RatingNodeDto[]): Draft {
  const root = nodes.find((n) => n.parentId === null);
  return nodes
    .filter((n) => n.parentId !== null)
    .sort((a, b) => a.depth - b.depth || a.sortOrder - b.sortOrder)
    .map((n) => ({
      key: n.id,
      parentKey: n.parentId === root?.id ? null : n.parentId,
      name: n.name,
      description: n.description,
      weight: n.weight,
      templateKey: n.templateKey,
    }));
}

export function childrenOf(draft: Draft, parentKey: string | null): TreeDraftNode[] {
  return draft.filter((n) => n.parentKey === parentKey);
}

/** Depth below Overall: categories are 1. */
export function depthOf(draft: Draft, key: string): number {
  let depth = 0;
  let current = draft.find((n) => n.key === key);
  while (current) {
    depth += 1;
    current = current.parentKey ? draft.find((n) => n.key === current!.parentKey) : undefined;
  }
  return depth;
}

export function addTemplate(draft: Draft, template: CategoryTemplate): Draft {
  const categoryKey = newKey();
  return [
    ...draft,
    {
      key: categoryKey,
      parentKey: null,
      name: template.name,
      description: template.description,
      weight: DEFAULT_IMPORTANCE,
      templateKey: template.key,
    },
    ...template.attributes.map((a) => ({
      key: newKey(),
      parentKey: categoryKey,
      name: a.name,
      description: a.description,
      weight: DEFAULT_IMPORTANCE,
      templateKey: a.key,
    })),
  ];
}

export function addNode(
  draft: Draft,
  parentKey: string | null,
  fields: { name: string; description?: string } = { name: "" },
): Draft {
  return [
    ...draft,
    {
      key: newKey(),
      parentKey,
      name: fields.name,
      description: fields.description ?? "",
      weight: DEFAULT_IMPORTANCE,
      templateKey: null,
    },
  ];
}

export function updateNode(
  draft: Draft,
  key: string,
  changes: Partial<Pick<TreeDraftNode, "name" | "description">>,
): Draft {
  return draft.map((n) => (n.key === key ? { ...n, ...changes } : n));
}

/** Removes a node and everything under it. */
export function removeNode(draft: Draft, key: string): Draft {
  const doomed = new Set([key]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of draft) {
      if (n.parentKey && doomed.has(n.parentKey) && !doomed.has(n.key)) {
        doomed.add(n.key);
        grew = true;
      }
    }
  }
  return draft.filter((n) => !doomed.has(n.key));
}

export function usedTemplateKeys(draft: Draft): Set<string> {
  return new Set(
    draft.filter((n) => n.parentKey === null && n.templateKey).map((n) => n.templateKey!),
  );
}
