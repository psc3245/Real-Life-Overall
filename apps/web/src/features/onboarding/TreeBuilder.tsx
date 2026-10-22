import {
  CATEGORY_TEMPLATES,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
  MAX_RATING_DEPTH,
  treeDraftSchema,
  type TreeDraftNode,
} from "@rlo/shared";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useSuggestAttributes } from "../../api/onboarding";
import { Button } from "../../components/Button";
import {
  addNode,
  addTemplate,
  childrenOf,
  depthOf,
  removeNode,
  updateNode,
  usedTemplateKeys,
  type Draft,
} from "./draft";
import { ErrorNote } from "./ErrorNote";

const LEVEL_NAMES = ["", "category", "attribute", "sub-attribute"];

function validate(draft: Draft): string | null {
  if (childrenOf(draft, null).length === 0) return "Add at least one category to get started.";
  if (draft.some((n) => !n.name.trim())) return "Every category and attribute needs a name.";
  const result = treeDraftSchema.safeParse({ nodes: draft });
  return result.success ? null : (result.error.issues[0]?.message ?? "The tree is invalid.");
}

export function TreeBuilder({
  initial,
  saving,
  saveError,
  onSave,
  saveLabel = "Save & set weights",
}: {
  initial: Draft;
  saving: boolean;
  saveError: unknown;
  onSave: (draft: Draft) => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const used = usedTemplateKeys(draft);
  const categories = childrenOf(draft, null);
  const problem = validate(draft);

  const toggleTemplate = (key: string) => {
    const existing = categories.find((c) => c.templateKey === key);
    const template = CATEGORY_TEMPLATES.find((t) => t.key === key)!;
    setDraft((d) => (existing ? removeNode(d, existing.key) : addTemplate(d, template)));
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-xl uppercase tracking-wider">Starter categories</h2>
        <p className="mt-1 text-sm text-court-300">
          Tap to add a category with suggested attributes. Everything stays editable.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORY_TEMPLATES.map((t) => {
            const on = used.has(t.key);
            return (
              <button
                key={t.key}
                type="button"
                aria-pressed={on}
                aria-label={t.name}
                onClick={() => toggleTemplate(t.key)}
                title={t.description}
                className={`rounded-full border px-4 py-1.5 font-display text-sm uppercase tracking-wider transition ${
                  on
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-court-700 text-court-300 hover:border-court-500 hover:text-court-100"
                }`}
              >
                {on ? "✓ " : "+ "}
                {t.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl uppercase tracking-wider">Your build</h2>
          <Button onClick={() => setDraft((d) => addNode(d, null))}>+ Custom category</Button>
        </div>
        {categories.length === 0 && (
          <p className="rounded-xl border border-dashed border-court-700 p-8 text-center text-court-500">
            No categories yet. Pick a starter above or create your own.
          </p>
        )}
        {categories.map((c) => (
          <div key={c.key} className="rounded-xl border border-court-700 bg-court-900/70 p-4">
            <NodeEditor node={c} draft={draft} setDraft={setDraft} />
          </div>
        ))}
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-court-800 bg-court-950/90 px-4 py-4 backdrop-blur">
        <div className="mr-auto min-w-0 text-sm">
          {problem ? (
            <span className="text-court-300">{problem}</span>
          ) : (
            <ErrorNote error={saveError} />
          )}
        </div>
        <Button variant="primary" disabled={!!problem || saving} onClick={() => onSave(draft)}>
          {saving ? "Saving…" : saveLabel}
        </Button>
      </div>
    </div>
  );
}

function NodeEditor({
  node,
  draft,
  setDraft,
}: {
  node: TreeDraftNode;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const depth = depthOf(draft, node.key);
  const children = childrenOf(draft, node.key);
  const canNest = depth < MAX_RATING_DEPTH;
  const suggest = useSuggestAttributes();
  const [showDescription, setShowDescription] = useState(Boolean(node.description));
  const level = LEVEL_NAMES[depth] ?? "attribute";
  const childLevel = LEVEL_NAMES[depth + 1] ?? "attribute";

  const runSuggest = () =>
    suggest.mutate(
      { name: node.name, description: node.description, existing: children.map((c) => c.name) },
      {
        onSuccess: (attributes) =>
          setDraft((d) => attributes.reduce((next, a) => addNode(next, node.key, a), d)),
      },
    );

  return (
    <div className={depth > 1 ? "border-l border-court-700 pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label={`${level} name`}
          value={node.name}
          maxLength={MAX_NODE_NAME_LENGTH}
          placeholder={`Name this ${level}`}
          onChange={(e) => setDraft((d) => updateNode(d, node.key, { name: e.target.value }))}
          className={`min-w-0 basis-full rounded-md border sm:basis-0 sm:flex-1 border-transparent bg-transparent px-2 py-1 outline-none hover:border-court-700 focus:border-neon ${
            depth === 1 ? "font-display text-2xl uppercase tracking-wide" : "text-base"
          }`}
        />
        <div className="-ml-2 flex flex-wrap items-center gap-1 sm:ml-0">
          {!showDescription && (
            <Button variant="ghost" onClick={() => setShowDescription(true)}>
              + note
            </Button>
          )}
          {canNest && (
            <Button variant="ghost" onClick={() => setDraft((d) => addNode(d, node.key))}>
              + {childLevel}
            </Button>
          )}
          {canNest && (
            <Button
              variant="ghost"
              disabled={!node.name.trim() || suggest.isPending}
              onClick={runSuggest}
              title="Ask the AI for attribute ideas"
            >
              {suggest.isPending ? "Thinking…" : "✦ Suggest"}
            </Button>
          )}
          <Button
            variant="danger"
            aria-label={`Remove ${node.name || level}`}
            onClick={() => setDraft((d) => removeNode(d, node.key))}
          >
            ✕
          </Button>
        </div>
      </div>
      {showDescription && (
        <input
          aria-label={`${level} description`}
          value={node.description}
          maxLength={MAX_NODE_DESCRIPTION_LENGTH}
          placeholder="What does this measure?"
          onChange={(e) =>
            setDraft((d) => updateNode(d, node.key, { description: e.target.value }))
          }
          className="mt-1 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-court-300 outline-none hover:border-court-700 focus:border-neon"
        />
      )}
      {suggest.isError && (
        <div className="mt-2">
          <ErrorNote error={suggest.error} />
        </div>
      )}
      {children.length > 0 && (
        <div className="mt-2 space-y-2">
          {children.map((child) => (
            <NodeEditor key={child.key} node={child} draft={draft} setDraft={setDraft} />
          ))}
        </div>
      )}
    </div>
  );
}
