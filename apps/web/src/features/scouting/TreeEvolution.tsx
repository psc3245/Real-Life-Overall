import type { TreeChangeDto, TreeProposalDto, WeightChangeDto } from "@rlo/shared";
import { Link } from "react-router";
import { useResolveTreeProposal, useUndoWeightChange } from "../../api/evolution";
import { Button } from "../../components/Button";
import { shortDate } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Weight shifts made by weekly reviews, each undoable while its season is current. */
export function WeightShiftList({
  changes,
  undoable = true,
}: {
  changes: WeightChangeDto[];
  undoable?: boolean;
}) {
  const undo = useUndoWeightChange();
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-court-800">
        {changes.map((c) => {
          const up = c.toShare > c.fromShare;
          return (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-2">
              <div className={`min-w-0 ${c.revertedAt ? "opacity-50" : ""}`}>
                <p>
                  <Link to={`/ratings/node/${c.nodeId}`} className="font-medium hover:text-neon">
                    {c.nodeName}
                  </Link>{" "}
                  <span className="font-display tabular-nums text-court-300">
                    {c.fromShare}% →{" "}
                    <span className={up ? "text-neon" : "text-flare"}>{c.toShare}%</span>
                  </span>
                  {c.revertedAt && (
                    <span className="ml-2 text-xs uppercase tracking-wider text-court-500">
                      Undone
                    </span>
                  )}
                </p>
                <p className="text-sm text-court-300">{c.reason}</p>
              </div>
              {undoable && !c.revertedAt && (
                <Button
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  disabled={undo.isPending}
                  onClick={() => undo.mutate(c.id)}
                >
                  Undo
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <ErrorNote error={undo.error} />
    </div>
  );
}

function ChangeLine({ change: c }: { change: TreeChangeDto }) {
  if (c.kind === "remove") {
    return (
      <li>
        <span className="font-display text-xs uppercase tracking-wider text-flare">Remove</span>{" "}
        <span className="font-medium">{c.nodeName}</span>
        <span className="text-sm text-court-500"> (its history stays in the ledger)</span>
      </li>
    );
  }
  if (c.kind === "add_attribute") {
    return (
      <li>
        <span className="font-display text-xs uppercase tracking-wider text-neon">Add</span>{" "}
        <span className="font-medium">{c.name}</span>
        <span className="text-court-500"> to {c.parentName}</span>
        {c.description && <span className="block text-sm text-court-300">{c.description}</span>}
      </li>
    );
  }
  return (
    <li>
      <span className="font-display text-xs uppercase tracking-wider text-neon">Add category</span>{" "}
      <span className="font-medium">{c.name}</span>
      {c.description && <span className="block text-sm text-court-300">{c.description}</span>}
      <span className="mt-1 flex flex-wrap gap-1.5">
        {c.attributes.map((a) => (
          <span
            key={a.name}
            title={a.description}
            className="rounded bg-court-800 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-court-300"
          >
            {a.name}
          </span>
        ))}
      </span>
    </li>
  );
}

const STATUS_LABEL: Record<TreeProposalDto["status"], string> = {
  pending: "Waiting on you",
  accepted: "✓ Applied",
  dismissed: "Dismissed",
  expired: "Expired",
};

/** A proposed tree change: what it adds or removes, why, and accept/dismiss. */
export function TreeProposalCard({ proposal: p }: { proposal: TreeProposalDto }) {
  const resolve = useResolveTreeProposal();
  const pending = p.status === "pending";
  return (
    <div
      className={`space-y-3 rounded-lg border p-4 ${pending ? "border-neon/50 bg-neon/5" : "border-court-700"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-sm uppercase tracking-wider text-court-300">
          Suggested tree change · {shortDate(p.createdAt.slice(0, 10))}
        </p>
        <span className="text-xs uppercase tracking-wider text-court-500">
          {STATUS_LABEL[p.status]}
        </span>
      </div>
      <p className="text-court-100">{p.reason}</p>
      <ul className="space-y-2">
        {p.changes.map((c, i) => (
          <ChangeLine key={i} change={c} />
        ))}
      </ul>
      {pending && (
        <>
          <p className="text-sm text-court-500">
            New attributes get a starting rating from the scout. Removed ones leave your rating for
            the rest of the season. You can always reshape the tree at the next season setup.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ id: p.id, action: "accept" })}
            >
              {resolve.isPending && resolve.variables?.action === "accept"
                ? "Rating new attributes…"
                : "Apply change"}
            </Button>
            <Button
              variant="ghost"
              disabled={resolve.isPending}
              onClick={() => resolve.mutate({ id: p.id, action: "dismiss" })}
            >
              Keep my tree
            </Button>
          </div>
        </>
      )}
      <ErrorNote error={resolve.error} />
    </div>
  );
}
