import { alignCategories, ratingTier, type ComparisonRow, type ProfileDto } from "@rlo/shared";
import { Link, useParams } from "react-router";
import { ApiError } from "../../api/client";
import { useMe } from "../../api/hooks";
import { useProfile } from "../../api/social";
import { OvrBadge } from "../../components/OvrBadge";
import { tierColor } from "../../components/tier";
import { ErrorNote } from "../onboarding/ErrorNote";

/** Side-by-side cards: you on the left, them on the right. */
export function ComparePage() {
  const { username = "" } = useParams();
  const me = useMe();
  const mine = useProfile(me.data?.username ?? "", Boolean(me.data));
  const theirs = useProfile(username);

  const error = me.error ?? mine.error ?? theirs.error;
  if (theirs.error instanceof ApiError && theirs.error.status === 404) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Can't compare</p>
        <p className="mt-2 text-court-300">This player hasn't shared their card with you.</p>
        <Link to="/friends" className="mt-6 inline-block text-neon hover:underline">
          Back to friends
        </Link>
      </div>
    );
  }
  if (error) return <ErrorNote error={error} />;
  if (!mine.data || !theirs.data) return <p className="pt-10 text-court-500">Loading…</p>;
  if (!mine.data.card || !theirs.data.card) {
    return (
      <p className="pt-10 text-court-300">
        {mine.data.card ? `${theirs.data.displayName} has` : "You have"} no rating to compare yet.
      </p>
    );
  }

  const rows = alignCategories(mine.data.card.categories, theirs.data.card.categories);
  return (
    <div className="mx-auto max-w-2xl space-y-8 pt-4">
      <h1 className="sr-only">
        {mine.data.displayName} vs {theirs.data.displayName}
      </h1>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side profile={mine.data} align="left" />
        <span className="font-display text-xl text-court-500">VS</span>
        <Side profile={theirs.data} align="right" />
      </div>
      <ul className="space-y-5" aria-label="Categories">
        {rows.map((row) => (
          <Row key={row.name} row={row} />
        ))}
      </ul>
      <p className="text-center text-xs text-court-500">
        Template categories line up even when renamed; custom ones match by name.
      </p>
    </div>
  );
}

function Side({ profile, align }: { profile: ProfileDto; align: "left" | "right" }) {
  const card = profile.card!;
  return (
    <Link
      to={`/u/${profile.username}`}
      className={`flex min-w-0 flex-col gap-2 hover:text-neon ${align === "left" ? "items-start" : "items-end text-right"}`}
    >
      <OvrBadge value={card.overall} />
      <span className="w-full truncate font-display text-lg uppercase">{profile.displayName}</span>
      <span className="w-full truncate text-xs uppercase tracking-wider text-court-500">
        {card.archetype ?? "Unranked"}
      </span>
    </Link>
  );
}

function Row({ row }: { row: ComparisonRow }) {
  const lead =
    row.mine != null && row.theirs != null && Math.abs(row.mine - row.theirs) >= 0.05
      ? row.mine > row.theirs
        ? "mine"
        : "theirs"
      : null;
  return (
    <li>
      <p className="mb-1 text-center text-sm font-medium uppercase tracking-wide text-court-300">
        {row.name}
      </p>
      <div className="grid grid-cols-[3.5rem_1fr_1fr_3.5rem] items-center gap-2">
        <Value value={row.mine} lead={lead === "mine"} />
        <Bar value={row.mine} side="left" label={`You: ${row.name}`} />
        <Bar value={row.theirs} side="right" label={`Them: ${row.name}`} />
        <Value value={row.theirs} lead={lead === "theirs"} align="right" />
      </div>
    </li>
  );
}

function Value({
  value,
  lead,
  align = "left",
}: {
  value: number | null;
  lead: boolean;
  align?: "left" | "right";
}) {
  return (
    <span
      className={`font-display text-xl tabular-nums ${align === "right" ? "text-right" : ""} ${value == null ? "text-court-700" : ""}`}
      style={value != null ? { color: tierColor(ratingTier(value)) } : undefined}
    >
      {value == null ? "—" : value.toFixed(1)}
      {lead && <span className="sr-only"> (leads)</span>}
    </span>
  );
}

function Bar({
  value,
  side,
  label,
}: {
  value: number | null;
  side: "left" | "right";
  label: string;
}) {
  const color = value != null ? tierColor(ratingTier(value)) : undefined;
  return (
    <div
      className={`flex h-2 rounded-full bg-court-700 ${side === "left" ? "justify-end" : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
    >
      {value != null && (
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
      )}
    </div>
  );
}
