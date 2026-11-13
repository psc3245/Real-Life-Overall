import { MAX_HABIT_BUCKETS, type HabitBucketDto } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import {
  useCreateBucket,
  useDeleteBucket,
  useRenameBucket,
  useReorderBuckets,
} from "../../api/days";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";

const smallButton =
  "rounded px-1.5 text-court-300 hover:text-neon disabled:opacity-30 disabled:hover:text-court-300";

/** Make, rename, reorder and delete the buckets habits are filed into. */
export function BucketsPanel({ buckets }: { buckets: HabitBucketDto[] }) {
  const create = useCreateBucket();
  const rename = useRenameBucket();
  const reorder = useReorderBuckets();
  const remove = useDeleteBucket();
  const [name, setName] = useState("");
  /** Bucket id being renamed, with its draft name. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(name.trim(), { onSuccess: () => setName("") });
  };
  const move = (i: number, delta: number) => {
    const ids = buckets.map((b) => b.id);
    [ids[i], ids[i + delta]] = [ids[i + delta]!, ids[i]!];
    reorder.mutate(ids);
  };

  return (
    <section className="space-y-3 rounded-xl border border-court-700 bg-court-900/40 p-4">
      <div>
        <h2 className="text-xs uppercase tracking-wider text-court-300">Buckets</h2>
        <p className="text-sm text-court-500">
          Sections to file habits into, like Morning or Health. Lists follow this order.
        </p>
      </div>
      {buckets.length > 0 && (
        <ul className="space-y-1.5">
          {buckets.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex flex-col leading-none">
                <button
                  type="button"
                  aria-label={`Move ${b.name} up`}
                  disabled={i === 0 || reorder.isPending}
                  onClick={() => move(i, -1)}
                  className={smallButton}
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Move ${b.name} down`}
                  disabled={i === buckets.length - 1 || reorder.isPending}
                  onClick={() => move(i, 1)}
                  className={smallButton}
                >
                  ▼
                </button>
              </span>
              {renaming?.id === b.id ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!renaming.name.trim()) return;
                    rename.mutate(
                      { id: b.id, name: renaming.name.trim() },
                      { onSuccess: () => setRenaming(null) },
                    );
                  }}
                >
                  <input
                    aria-label="Bucket name"
                    autoFocus
                    maxLength={40}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: b.id, name: e.target.value })}
                    className={`${compactFieldClass} w-44`}
                  />
                  <Button type="submit" variant="primary" disabled={rename.isPending}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setRenaming(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="min-w-0 flex-1 font-medium">{b.name}</span>
                  {confirming === b.id ? (
                    <span className="flex items-center gap-1 text-court-300">
                      Delete? Its habits stay, unfiled.
                      <Button
                        variant="danger"
                        disabled={remove.isPending}
                        onClick={() =>
                          remove.mutate(b.id, { onSettled: () => setConfirming(null) })
                        }
                      >
                        Delete
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirming(null)}>
                        Keep
                      </Button>
                    </span>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => setRenaming({ id: b.id, name: b.name })}
                      >
                        Rename
                      </Button>
                      <Button variant="danger" onClick={() => setConfirming(b.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {buckets.length < MAX_HABIT_BUCKETS && (
        <form onSubmit={add} className="flex gap-2">
          <input
            aria-label="New bucket name"
            value={name}
            maxLength={40}
            placeholder="New bucket, e.g. Morning"
            onChange={(e) => setName(e.target.value)}
            className={`${compactFieldClass} w-56`}
          />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            Add bucket
          </Button>
        </form>
      )}
      <ErrorNote error={create.error ?? rename.error ?? reorder.error ?? remove.error} />
    </section>
  );
}
