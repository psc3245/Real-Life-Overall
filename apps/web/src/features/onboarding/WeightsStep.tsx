import {
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  normalizeWeights,
  type OnboardingStateDto,
  type RatingNodeDto,
} from "@rlo/shared";
import { useState } from "react";
import { useSaveWeights, useSuggestWeights } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";

const clampImportance = (w: number) =>
  Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(w)));

const IMPORTANCE_LABELS: Record<number, string> = { 1: "Minor", 5: "Balanced", 10: "Central" };

export function WeightsStep({
  state,
  onBack,
  onSaved,
}: {
  state: OnboardingStateDto;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [priorities, setPriorities] = useState(state.priorities ?? "");
  const [rationale, setRationale] = useState(state.weightRationale);
  const [weights, setWeights] = useState(
    () =>
      new Map(state.nodes.filter((n) => n.parentId).map((n) => [n.id, clampImportance(n.weight)])),
  );
  const suggest = useSuggestWeights();
  const save = useSaveWeights();

  const parents = state.nodes.filter((p) => state.nodes.some((n) => n.parentId === p.id));
  const childrenOf = (id: string) => state.nodes.filter((n) => n.parentId === id);

  const runSuggest = () =>
    suggest.mutate(priorities, {
      onSuccess: (s) => {
        setWeights(new Map(s.weights.map((w) => [w.nodeId, w.weight])));
        setRationale(s.rationale);
      },
    });

  const setWeight = (id: string, weight: number) =>
    setWeights((prev) => new Map(prev).set(id, weight));

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-court-700 bg-court-900/70 p-5">
        <label htmlFor="priorities" className="font-display text-xl uppercase tracking-wider">
          What matters most to you right now?
        </label>
        <p className="mt-1 text-sm text-court-300">
          The AI proposes how much each category and attribute counts toward its parent. You get the
          final say with the sliders.
        </p>
        <textarea
          id="priorities"
          value={priorities}
          onChange={(e) => setPriorities(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Getting promoted this year matters most, then my health. Social life is fine as is."
          className="mt-3 w-full rounded-lg border border-court-700 bg-court-950 p-3 text-sm outline-none focus:border-neon"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={runSuggest} disabled={suggest.isPending}>
            {suggest.isPending ? "Thinking…" : "✦ Suggest weights"}
          </Button>
          <ErrorNote error={suggest.error} />
        </div>
        {rationale && (
          <p className="mt-4 border-l-2 border-neon/60 pl-3 text-sm text-court-300">{rationale}</p>
        )}
      </section>

      {parents.map((parent) => (
        <WeightGroup
          key={parent.id}
          parent={parent}
          nodes={childrenOf(parent.id)}
          weights={weights}
          onChange={setWeight}
        />
      ))}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-court-800 bg-court-950/90 px-4 py-4 backdrop-blur">
        <div className="mr-auto">
          <ErrorNote error={save.error} />
        </div>
        <Button variant="ghost" onClick={onBack}>
          ← Edit build
        </Button>
        <Button
          variant="primary"
          disabled={save.isPending}
          onClick={() =>
            save.mutate(
              [...weights].map(([nodeId, weight]) => ({ nodeId, weight })),
              { onSuccess: onSaved },
            )
          }
        >
          {save.isPending ? "Saving…" : "Lock in weights"}
        </Button>
      </div>
    </div>
  );
}

function WeightGroup({
  parent,
  nodes,
  weights,
  onChange,
}: {
  parent: RatingNodeDto;
  nodes: RatingNodeDto[];
  weights: Map<string, number>;
  onChange: (id: string, weight: number) => void;
}) {
  const values = nodes.map((n) => weights.get(n.id) ?? IMPORTANCE_MIN);
  const shares = normalizeWeights(values);

  return (
    <section>
      <h3 className="font-display text-lg uppercase tracking-wider text-court-300">
        {parent.parentId === null ? "Overall is made of" : parent.name}
      </h3>
      <div className="mt-3 space-y-3">
        {nodes.map((node, i) => (
          <div
            key={node.id}
            className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-3 sm:grid-cols-[12rem_1fr_4rem]"
          >
            <label htmlFor={`w-${node.id}`} className="truncate text-sm font-medium">
              {node.name}
            </label>
            <input
              id={`w-${node.id}`}
              type="range"
              min={IMPORTANCE_MIN}
              max={IMPORTANCE_MAX}
              step={1}
              value={values[i]}
              onChange={(e) => onChange(node.id, Number(e.target.value))}
              aria-valuetext={`${values[i]} — ${IMPORTANCE_LABELS[values[i]!] ?? ""}`}
              className="w-full accent-[var(--color-neon)]"
            />
            <span className="text-right font-display text-lg tabular-nums text-neon">
              {Math.round(shares[i]! * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
