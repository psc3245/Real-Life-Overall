import { MAX_CHART_METRICS, METRIC_GROUP_LABELS, METRIC_GROUPS, type MetricDto } from "@rlo/shared";
import { useState } from "react";
import { compactFieldClass } from "../../components/form";

/** Grouped, searchable checklist of every metric (charts and reports). */
export function MetricPicker({
  metrics,
  selected,
  onToggle,
  loading,
}: {
  metrics: MetricDto[];
  selected: string[];
  onToggle: (id: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = metrics.filter(
    (m) => !q || m.label.toLowerCase().includes(q) || (m.detail ?? "").toLowerCase().includes(q),
  );
  const full = selected.length >= MAX_CHART_METRICS;
  return (
    <div className="space-y-3 rounded-xl border border-court-700 bg-court-900/70 p-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-sm uppercase tracking-wider">
          Metrics{" "}
          <span className="text-court-500">
            {selected.length}/{MAX_CHART_METRICS}
          </span>
        </h2>
      </div>
      <input
        aria-label="Search metrics"
        value={query}
        placeholder="Search"
        onChange={(e) => setQuery(e.target.value)}
        // Inside a form (the report editor), Enter shouldn't submit it.
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        className={`${compactFieldClass} w-full`}
      />
      {loading && <p className="text-sm text-court-500">Loading…</p>}
      <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
        {METRIC_GROUPS.map((g) => {
          const items = shown.filter((m) => m.group === g);
          if (!items.length) return null;
          return (
            <div key={g}>
              <p className="mb-1 text-[11px] uppercase tracking-wider text-court-500">
                {METRIC_GROUP_LABELS[g]}
              </p>
              <ul className="space-y-0.5">
                {items.map((m) => {
                  const on = selected.includes(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        disabled={!on && full}
                        onClick={() => onToggle(m.id)}
                        className={`flex w-full items-start gap-2 rounded px-2 py-1 text-left text-sm disabled:opacity-40 ${on ? "bg-neon/10 text-neon" : "hover:bg-court-800"}`}
                      >
                        <span
                          aria-hidden
                          className={`mt-1 h-3 w-3 shrink-0 rounded-sm border ${on ? "border-neon bg-neon" : "border-court-500"}`}
                        />
                        <span className="min-w-0">
                          <span className="block truncate">{m.label}</span>
                          {m.detail && (
                            <span className="block truncate text-[11px] text-court-500">
                              {m.detail}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
