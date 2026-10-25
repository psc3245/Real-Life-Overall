import { leafIds, type RatedNodeDto } from "@rlo/shared";

/** Rated attributes as toggle chips, one row per category. */
export function AttributePicker({
  nodes,
  selected,
  onToggle,
}: {
  nodes: RatedNodeDto[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const leaves = new Set(leafIds(nodes));
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);
  const leavesUnder = (id: string): RatedNodeDto[] =>
    leaves.has(id)
      ? nodes.filter((n) => n.id === id)
      : nodes.filter((n) => n.parentId === id).flatMap((c) => leavesUnder(c.id));

  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <div key={c.id} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 truncate text-xs uppercase tracking-wider text-court-500">
            {c.name}
          </span>
          {leavesUnder(c.id).map((leaf) => (
            <button
              key={leaf.id}
              type="button"
              aria-pressed={selected.includes(leaf.id)}
              onClick={() => onToggle(leaf.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                selected.includes(leaf.id)
                  ? "border-neon bg-neon/15 text-neon"
                  : "border-court-700 text-court-300 hover:border-court-500"
              }`}
            >
              {leaf.name}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
