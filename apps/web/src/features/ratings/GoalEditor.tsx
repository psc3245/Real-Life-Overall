import type { RatedNodeDto } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { useSetGoal } from "../../api/ratings";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";
import { formatScore, useScore } from "../../components/score";

/**
 * Set or clear a node's goal (a rating, or in a growth season the points to gain); shows the
 * season-end projection beside it.
 */
export function GoalEditor({ node }: { node: RatedNodeDto }) {
  const { mode } = useScore();
  const setGoal = useSetGoal();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(node.goal?.toString() ?? "");

  const save = (e: FormEvent) => {
    e.preventDefault();
    const target = Number(value);
    if (!Number.isFinite(target) || target < 0 || target > 100) return;
    setGoal.mutate({ nodeId: node.id, target }, { onSuccess: () => setEditing(false) });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs uppercase tracking-wider text-court-500">
      {node.projection != null && (
        <span>Projected {formatScore(mode, node.projection)} by season end</span>
      )}
      {editing ? (
        <form onSubmit={save} className="flex items-center gap-1 normal-case tracking-normal">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            autoFocus
            aria-label={`${mode === "growth" ? "Points to gain" : "Goal"} for ${node.name}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-20 rounded-md border border-court-700 bg-court-950 px-2 py-1 text-sm text-court-100 outline-none focus:border-neon"
          />
          <Button type="submit" variant="ghost" disabled={setGoal.isPending || value === ""}>
            Save
          </Button>
          {node.goal != null && (
            <Button
              variant="danger"
              disabled={setGoal.isPending}
              onClick={() =>
                setGoal.mutate(
                  { nodeId: node.id, target: null },
                  { onSuccess: () => (setEditing(false), setValue("")) },
                )
              }
            >
              Clear
            </Button>
          )}
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="uppercase tracking-wider hover:text-neon"
        >
          {node.goal != null
            ? `Goal ${formatScore(mode, node.goal)} · edit`
            : mode === "growth"
              ? "+ Set growth target"
              : "+ Set goal"}
        </button>
      )}
      <ErrorNote error={setGoal.error} />
    </div>
  );
}
