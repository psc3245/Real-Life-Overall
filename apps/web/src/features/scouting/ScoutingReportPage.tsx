import {
  IMPORTANCE_LABELS,
  MAX_ASPIRATIONS,
  MAX_CONSTRAINTS,
  MAX_PRIORITIES,
  MAX_REPORT_FOCUSES,
  MAX_REPORT_LINE,
  type ScoutingReportBody,
  type ScoutingReportDto,
  type WeightsDto,
} from "@rlo/shared";
import { useState } from "react";
import { Link } from "react-router";
import {
  useSaveScoutingReport,
  useScoutingReport,
  useTreeProposals,
  useWeights,
} from "../../api/evolution";
import { usePreferences } from "../../api/preferences";
import { Button } from "../../components/Button";
import { DebugJson } from "../../components/debug/Debug";
import { compactFieldClass } from "../../components/form";
import { NodeChip } from "../../components/NodeChip";
import { SectionNav } from "../../components/SectionNav";
import { shortDate } from "../../lib/format";
import { ErrorNote } from "../onboarding/ErrorNote";
import { TreeProposalCard, WeightShiftList } from "./TreeEvolution";
import { cap, useTalk } from "../../lib/talk";

export function ScoutingReportPage() {
  const talk = useTalk();
  const report = useScoutingReport();
  const weights = useWeights();
  const proposals = useTreeProposals();
  const [editing, setEditing] = useState(false);

  if (report.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (report.isError) return <ErrorNote error={report.error} />;
  const r = report.data;

  return (
    <div className="space-y-10 pt-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-neon">{talk.scoutingReportTagline}</p>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
          {talk.scoutingReport}
        </h1>
        <p className="max-w-2xl text-court-300">
          {cap(talk.scout)}'s picture of what you want out of life. Each weekly review updates it,
          and your rating is tuned to match it: weights drift toward what matters to you, and now
          and then {talk.scout} suggests adding or removing part of your tree.
        </p>
        {r.updatedAt && (
          <p className="text-sm text-court-500">
            Updated {shortDate(r.updatedAt.slice(0, 10))} by{" "}
            {r.updatedBy === "user" ? "you" : talk.scout}
          </p>
        )}
      </header>

      <SectionNav
        sections={[
          { id: "report", label: "Report" },
          { id: "shape", label: "Rating shape" },
          { id: "tree", label: "Tree changes" },
        ]}
      />

      <section id="report" className="scroll-mt-16 space-y-4">
        {editing ? (
          <ReportEditor report={r} onDone={() => setEditing(false)} />
        ) : (
          <ReportView report={r} onEdit={() => setEditing(true)} />
        )}
      </section>

      <section id="shape" className="scroll-mt-16 space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-wider">Rating shape</h2>
        {weights.isPending && <p className="text-court-500">Loading…</p>}
        <ErrorNote error={weights.error} />
        {weights.data && <RatingShape weights={weights.data} />}
      </section>

      <section id="tree" className="scroll-mt-16 space-y-4">
        <h2 className="font-display text-2xl uppercase tracking-wider">Tree changes</h2>
        <p className="text-sm text-court-500">
          The tree changes rarely: at most one suggestion every four weeks, never in a season's last
          two weeks, and only with your OK.
        </p>
        <ErrorNote error={proposals.error} />
        {proposals.data?.length === 0 && (
          <p className="rounded-xl border border-dashed border-court-700 p-6 text-center text-court-500">
            No suggestions yet. Your tree fits what {talk.scout} knows so far.
          </p>
        )}
        <div className="space-y-3">
          {proposals.data?.map((p) => (
            <TreeProposalCard key={p.id} proposal={p} />
          ))}
        </div>
      </section>
      <DebugJson label="scouting report" data={{ report: r, weights: weights.data }} />
    </div>
  );
}

function Importance({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" title={IMPORTANCE_LABELS[value]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i <= value ? "bg-neon" : "bg-court-700"}`}
        />
      ))}
      <span className="sr-only">{IMPORTANCE_LABELS[value]}</span>
    </span>
  );
}

function ReportView({ report: r, onEdit }: { report: ScoutingReportDto; onEdit: () => void }) {
  const talk = useTalk();
  const empty =
    !r.aspirations.length && !r.priorities.length && !r.focuses.length && !r.constraints.length;
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div className="space-y-1">
        <h3 className="font-display text-sm uppercase tracking-wider text-court-300">{title}</h3>
        <ul className="list-inside list-disc space-y-0.5 text-court-100 marker:text-neon">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="space-y-5 rounded-xl border border-court-700 bg-court-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl uppercase tracking-wider">The report</h2>
        <Button onClick={onEdit}>{empty ? "Fill it in" : "Edit"}</Button>
      </div>
      {empty && (
        <p className="text-court-300">
          Empty for now. {cap(talk.scout)} writes it after your next weekly review, or you can fill
          it in yourself.
        </p>
      )}
      {list("Aspirations", r.aspirations)}
      {r.priorities.length > 0 && (
        <div className="space-y-1">
          <h3 className="font-display text-sm uppercase tracking-wider text-court-300">
            Priorities
          </h3>
          <ul className="divide-y divide-court-800">
            {r.priorities.map((p) => (
              <li key={p.area} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <Importance value={p.importance} />
                <span className="font-medium">{p.area}</span>
                {p.nodeId ? (
                  <NodeChip id={p.nodeId} name={p.nodeName ?? undefined} />
                ) : (
                  <span className="rounded border border-dashed border-court-600 px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-court-500">
                    Not in your tree
                  </span>
                )}
                {p.note && <span className="w-full text-sm text-court-300">{p.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {list("Current focuses", r.focuses)}
      {list("Constraints", r.constraints)}
    </div>
  );
}

/** Text lines with add and remove. */
function LinesField({
  label,
  values,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  max: number;
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-display text-sm uppercase tracking-wider text-court-300">
        {label}
      </legend>
      {values.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input
            aria-label={`${label} ${i + 1}`}
            value={v}
            maxLength={MAX_REPORT_LINE}
            placeholder={placeholder}
            onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            className={`${compactFieldClass} min-w-0 flex-1`}
          />
          <Button
            variant="danger"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      {values.length < max && (
        <Button variant="ghost" className="px-0" onClick={() => onChange([...values, ""])}>
          + Add
        </Button>
      )}
    </fieldset>
  );
}

function ReportEditor({ report, onDone }: { report: ScoutingReportDto; onDone: () => void }) {
  const save = useSaveScoutingReport();
  const weights = useWeights();
  const [draft, setDraft] = useState<ScoutingReportBody>({
    aspirations: report.aspirations,
    priorities: report.priorities.map(({ area, importance, nodeId, note }) => ({
      area,
      importance,
      nodeId,
      note,
    })),
    focuses: report.focuses,
    constraints: report.constraints,
  });
  const set = <K extends keyof ScoutingReportBody>(key: K, value: ScoutingReportBody[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const nodes = weights.data?.nodes ?? [];
  const clean = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

  return (
    <form
      className="space-y-6 rounded-xl border border-neon/40 bg-court-900 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(
          {
            aspirations: clean(draft.aspirations),
            priorities: draft.priorities.filter((p) => p.area.trim()),
            focuses: clean(draft.focuses),
            constraints: clean(draft.constraints),
          },
          { onSuccess: onDone },
        );
      }}
    >
      <LinesField
        label="Aspirations"
        values={draft.aspirations}
        max={MAX_ASPIRATIONS}
        placeholder="e.g. Run a marathon before I'm 40"
        onChange={(v) => set("aspirations", v)}
      />

      <fieldset className="space-y-2">
        <legend className="font-display text-sm uppercase tracking-wider text-court-300">
          Priorities
        </legend>
        {draft.priorities.map((p, i) => {
          const update = (patch: Partial<typeof p>) =>
            set(
              "priorities",
              draft.priorities.map((x, j) => (j === i ? { ...x, ...patch } : x)),
            );
          return (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-court-800 p-3 sm:grid-cols-[1fr_auto_auto_auto]"
            >
              <input
                aria-label={`Priority ${i + 1} area`}
                value={p.area}
                placeholder="Life area"
                onChange={(e) => update({ area: e.target.value })}
                className={compactFieldClass}
              />
              <select
                aria-label={`Priority ${i + 1} importance`}
                value={p.importance}
                onChange={(e) => update({ importance: Number(e.target.value) })}
                className={compactFieldClass}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} · {IMPORTANCE_LABELS[n]}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Priority ${i + 1} measured by`}
                value={p.nodeId ?? ""}
                onChange={(e) => update({ nodeId: e.target.value || null })}
                className={compactFieldClass}
              >
                <option value="">Not in my tree</option>
                {nodes.map((n) => (
                  <option key={n.nodeId} value={n.nodeId}>
                    {n.depth > 1 ? "— " : ""}
                    {n.name}
                  </option>
                ))}
              </select>
              <Button
                variant="danger"
                aria-label={`Remove priority ${i + 1}`}
                onClick={() =>
                  set(
                    "priorities",
                    draft.priorities.filter((_, j) => j !== i),
                  )
                }
              >
                ✕
              </Button>
              <input
                aria-label={`Priority ${i + 1} note`}
                value={p.note}
                maxLength={MAX_REPORT_LINE}
                placeholder="Why it matters (optional)"
                onChange={(e) => update({ note: e.target.value })}
                className={`${compactFieldClass} sm:col-span-4`}
              />
            </div>
          );
        })}
        {draft.priorities.length < MAX_PRIORITIES && (
          <Button
            variant="ghost"
            className="px-0"
            onClick={() =>
              set("priorities", [
                ...draft.priorities,
                { area: "", importance: 3, nodeId: null, note: "" },
              ])
            }
          >
            + Add
          </Button>
        )}
      </fieldset>

      <LinesField
        label="Current focuses"
        values={draft.focuses}
        max={MAX_REPORT_FOCUSES}
        placeholder="e.g. Getting promoted this cycle"
        onChange={(v) => set("focuses", v)}
      />
      <LinesField
        label="Constraints"
        values={draft.constraints}
        max={MAX_CONSTRAINTS}
        placeholder="e.g. Knee injury, no running until spring"
        onChange={(v) => set("constraints", v)}
      />
      <ErrorNote error={save.error} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={save.isPending}>
          Save report
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Every node's share of its parent now, against season start, plus the shifts that moved it. */
function RatingShape({ weights }: { weights: WeightsDto }) {
  const prefs = usePreferences();
  const categories = weights.nodes.filter((n) => n.depth === 1);
  return (
    <div className="space-y-5">
      {!weights.adaptive && (
        <p className="rounded-lg border border-court-700 p-3 text-sm text-court-300">
          Adaptive rating is off, so weekly reviews leave your weights and tree alone.{" "}
          <Link to="?prefs=configuration" className="text-neon hover:underline">
            Turn it on
          </Link>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <div
            key={c.nodeId}
            className="space-y-2 rounded-xl border border-court-700 bg-court-900/70 p-4"
          >
            <ShareBar name={c.name} share={c.share} start={c.startShare} bold />
            {weights.nodes
              .filter((n) => n.parentId === c.nodeId)
              .map((n) => (
                <ShareBar key={n.nodeId} name={n.name} share={n.share} start={n.startShare} />
              ))}
          </div>
        ))}
      </div>
      <p className="text-sm text-court-500">
        Bars show each part's share of its parent. The tick marks where it started the season.
        {prefs.features.adaptiveRating &&
          " Shifts are small (15% of a weight at most per week) and stay within half to double the starting weight."}
      </p>
      {weights.changes.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg uppercase tracking-wider">Weight shifts</h3>
          <WeightShiftList changes={weights.changes} />
        </div>
      )}
    </div>
  );
}

function ShareBar({
  name,
  share,
  start,
  bold = false,
}: {
  name: string;
  share: number;
  start: number;
  bold?: boolean;
}) {
  const moved = share - start;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className={bold ? "font-display uppercase tracking-wider" : "text-court-300"}>
          {name}
        </span>
        <span className="font-display tabular-nums">
          {share}%
          {Math.abs(moved) >= 0.1 && (
            <span className={`ml-1 text-xs ${moved > 0 ? "text-neon" : "text-flare"}`}>
              {moved > 0 ? "+" : ""}
              {moved.toFixed(1)}
            </span>
          )}
        </span>
      </div>
      <div className="relative mt-1 h-1.5 rounded-full bg-court-800">
        <div
          className={`h-full rounded-full ${bold ? "bg-neon" : "bg-neon/60"}`}
          style={{ width: `${Math.min(100, share)}%` }}
        />
        <span
          aria-hidden
          className="absolute -top-0.5 h-2.5 w-0.5 bg-court-100"
          style={{ left: `${Math.min(100, start)}%` }}
        />
      </div>
    </div>
  );
}
