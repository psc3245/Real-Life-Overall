import { Link } from "react-router";

/** A small attribute tag that opens the attribute's page. */
export function NodeChip({ id, name }: { id: string; name: string | undefined }) {
  return (
    <Link
      to={`/ratings/node/${id}`}
      className="rounded bg-court-800 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-court-300 hover:bg-court-700 hover:text-neon"
    >
      {name ?? "?"}
    </Link>
  );
}
