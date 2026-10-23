import {
  BADGE_TIER_LABELS,
  BADGE_TIERS,
  type BadgeProgressDto,
  type EarnedBadgeDto,
} from "@rlo/shared";
import { useState } from "react";
import { useBadges } from "../../api/badges";
import { Medallion, TIER_COLORS } from "../../components/BadgeChip";
import { Modal } from "../../components/Modal";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

const earnedOn = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function BadgesSection() {
  const badges = useBadges();
  const [open, setOpen] = useState<string | null>(null);
  if (!badges.data) return null;
  const { progress, personal } = badges.data;
  const openCatalog = progress.find((b) => b.key === open);
  const openPersonal = personal.find((b) => b.key === open);

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl uppercase tracking-wider">Badges</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {progress.map((b) => {
          const share = b.next ? Math.min(1, b.value / b.next) : 1;
          const color = b.tier ? TIER_COLORS[b.tier] : "var(--color-court-500)";
          return (
            <li key={b.key}>
              <button
                type="button"
                onClick={() => setOpen(b.key)}
                aria-haspopup="dialog"
                className={`block h-full w-full space-y-2 rounded-xl border bg-court-900/70 p-4 text-left transition hover:border-neon/60 ${b.tier ? "border-court-700" : "border-court-800 opacity-80"}`}
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
              </button>
            </li>
          );
        })}
      </ul>
      {personal.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Personal</h3>
          <ul className="flex flex-wrap gap-3">
            {personal.map((b) => (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => setOpen(b.key)}
                  aria-haspopup="dialog"
                  className="flex items-center gap-3 rounded-xl border border-neon/30 bg-court-900/70 p-3 text-left hover:border-neon"
                >
                  <Medallion tier={null} size={30} />
                  <span>
                    <span className="block font-medium">{b.name}</span>
                    <span className="block text-sm text-court-300">{b.description}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Modal
        open={Boolean(openCatalog || openPersonal)}
        onClose={() => setOpen(null)}
        label={openCatalog?.name ?? openPersonal?.name ?? "Badge"}
      >
        {openCatalog && <CatalogDetail badge={openCatalog} onClose={() => setOpen(null)} />}
        {openPersonal && <PersonalDetail badge={openPersonal} onClose={() => setOpen(null)} />}
      </Modal>
    </section>
  );
}

function DetailHeader({
  tier,
  locked = false,
  title,
  subtitle,
  onClose,
}: {
  tier: BadgeProgressDto["tier"];
  locked?: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Medallion tier={tier} size={48} locked={locked} />
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-2xl uppercase">{title}</h3>
        <p className="text-xs uppercase tracking-wider text-court-500">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-xl text-court-500 hover:text-neon"
      >
        ×
      </button>
    </div>
  );
}

/** A catalog badge's ladder: each tier's bar, when it was earned, and how far to the next. */
function CatalogDetail({ badge: b, onClose }: { badge: BadgeProgressDto; onClose: () => void }) {
  const earned = new Map(b.earned.map((e) => [e.tier, e.earnedAt]));
  const nextIndex = b.tier ? BADGE_TIERS.indexOf(b.tier) + 1 : 0;
  return (
    <div className="space-y-4">
      <DetailHeader
        tier={b.tier}
        locked={!b.tier}
        title={b.name}
        subtitle={b.tier ? `${BADGE_TIER_LABELS[b.tier]} reached` : "Not earned yet"}
        onClose={onClose}
      />
      <p className="text-court-300">{b.description}</p>
      <p className="font-display text-3xl tabular-nums">
        {fmt(b.value)} <span className="text-base text-court-500">{b.unit}</span>
      </p>
      <ol className="space-y-3" aria-label="Tiers">
        {BADGE_TIERS.map((tier, i) => {
          const threshold = b.thresholds[i]!;
          const done = i < nextIndex;
          const isNext = i === nextIndex;
          const share = done ? 1 : Math.min(1, b.value / threshold);
          return (
            <li key={tier} className={`space-y-1 ${!done && !isNext ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-2 text-sm">
                <Medallion tier={tier} size={22} locked={!done} />
                <span className="font-medium">{BADGE_TIER_LABELS[tier]}</span>
                <span className="tabular-nums text-court-500">
                  {fmt(threshold)} {b.unit}
                </span>
                <span className="ml-auto text-xs text-court-300">
                  {done
                    ? earned.get(tier)
                      ? `Earned ${earnedOn(earned.get(tier)!)}`
                      : "Earned"
                    : isNext
                      ? `${fmt(Math.max(0, threshold - b.value))} to go`
                      : "Locked"}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-court-700">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${share * 100}%`, background: TIER_COLORS[tier] }}
                />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="rounded-lg bg-court-950/60 p-3 text-sm text-court-300">
        <span className="font-display uppercase tracking-wider text-neon">How to progress: </span>
        {b.hint}
      </p>
    </div>
  );
}

function PersonalDetail({ badge: b, onClose }: { badge: EarnedBadgeDto; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <DetailHeader
        tier={null}
        title={b.name}
        subtitle={`Personal badge · earned ${earnedOn(b.earnedAt)}`}
        onClose={onClose}
      />
      <p className="text-court-300">{b.description}</p>
      <p className="text-sm text-court-500">
        Personal badges are awarded by your weekly reviews for something specific to you. They have
        no tiers and don't appear on your shared card.
      </p>
    </div>
  );
}
