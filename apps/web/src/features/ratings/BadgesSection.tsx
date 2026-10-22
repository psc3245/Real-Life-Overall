import { BADGE_TIER_LABELS } from "@rlo/shared";
import { useBadges } from "../../api/badges";
import { Medallion, TIER_COLORS } from "../../components/BadgeChip";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function BadgesSection() {
  const badges = useBadges();
  if (!badges.data) return null;
  const { progress, personal } = badges.data;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl uppercase tracking-wider">Badges</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {progress.map((b) => {
          const share = b.next ? Math.min(1, b.value / b.next) : 1;
          const color = b.tier ? TIER_COLORS[b.tier] : "var(--color-court-500)";
          return (
            <li
              key={b.key}
              className={`space-y-2 rounded-xl border bg-court-900/70 p-4 ${b.tier ? "border-court-700" : "border-court-800 opacity-80"}`}
            >
              <div className="flex items-center gap-3">
                <Medallion tier={b.tier} locked={!b.tier} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-xs uppercase tracking-wider text-court-500">
                    {b.tier ? BADGE_TIER_LABELS[b.tier] : "Not earned yet"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-court-300">{b.description}</p>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-court-700"
                role="progressbar"
                aria-label={`${b.name} progress`}
                aria-valuenow={b.value}
                aria-valuemax={b.next ?? b.value}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: color }}
                />
              </div>
              <p className="text-xs tabular-nums text-court-500">
                {b.next
                  ? `${fmt(b.value)} / ${fmt(b.next)} ${b.unit}`
                  : `${fmt(b.value)} ${b.unit} · maxed`}
              </p>
            </li>
          );
        })}
      </ul>
      {personal.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Personal</h3>
          <ul className="flex flex-wrap gap-3">
            {personal.map((b) => (
              <li
                key={b.key}
                className="flex items-center gap-3 rounded-xl border border-neon/30 bg-court-900/70 p-3"
              >
                <Medallion tier={null} size={30} />
                <div>
                  <p className="font-medium">{b.name}</p>
                  <p className="text-sm text-court-300">{b.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
