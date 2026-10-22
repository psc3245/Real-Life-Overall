import {
  CATEGORY_TEMPLATES,
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
  treeDraftSchema,
  type TreeDraftNode,
  templateOutputSchema,
} from "@rlo/shared";
import type { z } from "zod";

type Output = z.infer<typeof templateOutputSchema>;

export const MAX_TEMPLATE_CATEGORIES = 7;
export const MAX_TEMPLATE_ATTRIBUTES = 5;
export const MAX_TEMPLATE_SUBATTRIBUTES = 4;

const importance = (w: number) =>
  Number.isFinite(w) ? Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(w))) : 5;
const name = (s: string) => s.trim().slice(0, MAX_NODE_NAME_LENGTH);
const desc = (s: string) => s.trim().slice(0, MAX_NODE_DESCRIPTION_LENGTH);
const validKeys = new Set(CATEGORY_TEMPLATES.map((t) => t.key));

/**
 * Turns the model's nested tree into draft nodes: trims names, caps counts, clamps weights,
 * drops blanks and duplicate siblings, and keeps template keys only when they're real.
 */
export function templateToDraft(output: Output): TreeDraftNode[] {
  const nodes: TreeDraftNode[] = [];
  let next = 0;
  const key = () => `t${++next}`;
  const unique = <T extends { name: string }>(items: T[], max: number) => {
    const seen = new Set<string>();
    return items
      .filter((i) => {
        const n = name(i.name).toLowerCase();
        if (!n || seen.has(n)) return false;
        seen.add(n);
        return true;
      })
      .slice(0, max);
  };

  for (const category of unique(output.categories, MAX_TEMPLATE_CATEGORIES)) {
    const categoryKey = key();
    nodes.push({
      key: categoryKey,
      parentKey: null,
      name: name(category.name),
      description: desc(category.description),
      weight: importance(category.weight),
      templateKey:
        category.templateKey && validKeys.has(category.templateKey) ? category.templateKey : null,
    });
    for (const attribute of unique(category.attributes, MAX_TEMPLATE_ATTRIBUTES)) {
      const attributeKey = key();
      nodes.push({
        key: attributeKey,
        parentKey: categoryKey,
        name: name(attribute.name),
        description: desc(attribute.description),
        weight: importance(attribute.weight),
        templateKey: null,
      });
      for (const sub of unique(attribute.subAttributes, MAX_TEMPLATE_SUBATTRIBUTES)) {
        nodes.push({
          key: key(),
          parentKey: attributeKey,
          name: name(sub.name),
          description: desc(sub.description),
          weight: importance(sub.weight),
          templateKey: null,
        });
      }
    }
  }
  return treeDraftSchema.parse({ nodes }).nodes;
}

/** Schema the LLM client validates against: the tree must have at least one category. */
export const templateSchema = templateOutputSchema.refine(
  (o) => o.categories.some((c) => c.name.trim()),
  "The template needs at least one category",
);
