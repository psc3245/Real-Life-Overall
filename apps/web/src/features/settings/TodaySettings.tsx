import {
  DEFAULT_PREFERENCES,
  TODAY_WIDGET_FEATURE,
  type TodayPreferences,
  type TodayWidget,
} from "@rlo/shared";
import { Link } from "react-router";
import { useMe } from "../../api/hooks";
import { usePreferences, useSetPreferences } from "../../api/preferences";
import {
  HeaderAction,
  SaveStatus,
  Segmented,
  Select,
  SettingRow,
  SettingsCard,
  Toggle,
} from "./controls";
import { FEATURE_INFO } from "./featureInfo";

const WIDGET_INFO: Record<TodayWidget, { label: string; detail: string }> = {
  missed: { label: "Missed recaps", detail: "A reminder when a logged day hasn't been recapped." },
  habits: { label: "Habits", detail: "Today's scheduled habits and how many are done." },
  rating: { label: "Your rating", detail: "Overall, its 7-day trend and the hottest movers." },
  goals: { label: "Goals", detail: "Running goals with progress and pace." },
  journal: { label: "Journal", detail: "A peek at today's entry and guided questions." },
  training: { label: "Training", detail: "Today's workouts and a shortcut to start one." },
  charts: { label: "Pinned charts", detail: "Charts you've pinned in the chart explorer." },
  focus: { label: "Focus", detail: "Suggested areas to work on." },
  coach: { label: "Coach", detail: "Ask the coach a question, or start from a suggestion." },
  recap: { label: "Recap", detail: "Today's recap, or yesterday's until you end the day." },
};

export function TodaySettings() {
  const prefs = usePreferences();
  const setPreferences = useSetPreferences();
  const t = prefs.today;
  const firstName = useMe().data?.displayName.split(" ")[0] ?? "you";
  const set = (changes: Partial<TodayPreferences>) =>
    setPreferences({ today: { ...t, ...changes } });

  const move = (index: number, by: number) => {
    const widgets = [...t.widgets];
    const [w] = widgets.splice(index, 1);
    widgets.splice(index + by, 0, w!);
    set({ widgets });
  };
  const update = (index: number, changes: { visible?: boolean; wide?: boolean }) =>
    set({ widgets: t.widgets.map((w, i) => (i === index ? { ...w, ...changes } : w)) });
  const isDefault = JSON.stringify(t) === JSON.stringify(DEFAULT_PREFERENCES.today);

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Today page"
        description="What the Today page greets you with and how it's laid out."
        action={
          <>
            <SaveStatus />
            {!isDefault && (
              <HeaderAction onClick={() => setPreferences({ today: DEFAULT_PREFERENCES.today })}>
                Reset
              </HeaderAction>
            )}
            <Link to="/today" className="text-neon hover:underline">
              View →
            </Link>
          </>
        }
      >
        <SettingRow label="Layout">
          <Segmented
            label="Layout"
            value={t.layout}
            onChange={(layout) => set({ layout })}
            options={[
              { value: "columns", label: "Two columns" },
              { value: "stack", label: "One column" },
            ]}
          />
        </SettingRow>
        <SettingRow label="Goals shown" htmlFor="today-goals">
          <Select
            id="today-goals"
            label="Goals shown"
            value={t.goalsShown}
            onChange={(goalsShown) => set({ goalsShown })}
            options={[2, 4, 6, 10].map((n) => ({ value: n, label: String(n) }))}
          />
        </SettingRow>
        <SettingRow label="Rating movers shown" htmlFor="today-movers">
          <Select
            id="today-movers"
            label="Rating movers shown"
            value={t.moversShown}
            onChange={(moversShown) => set({ moversShown })}
            options={[0, 2, 4, 6].map((n) => ({ value: n, label: n ? String(n) : "None" }))}
          />
        </SettingRow>
        <Toggle
          checked={t.greeting}
          onChange={(greeting) => set({ greeting })}
          label="Greet me by name"
          detail={`A greeting like "Evening, ${firstName}" instead of "Today" as the page title.`}
        />
        <Toggle
          checked={t.showLogButton}
          onChange={(showLogButton) => set({ showLogButton })}
          label="Show the Log today button"
        />
        <Toggle
          checked={t.hideDoneHabits}
          onChange={(hideDoneHabits) => set({ hideDoneHabits })}
          label="Hide finished habits"
          detail="The habits card lists only what's left; the count still shows everything."
        />
      </SettingsCard>

      <SettingsCard
        title="Widgets"
        description="Top to bottom. Tick to show, use the arrows to reorder."
      >
        <ol className="divide-y divide-court-800">
          {t.widgets.map((w, i) => {
            const feature = TODAY_WIDGET_FEATURE[w.id];
            const off = feature !== undefined && !prefs.features[feature];
            return (
              <li key={w.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={w.visible && !off}
                  disabled={off}
                  onChange={(e) => update(i, { visible: e.target.checked })}
                  aria-label={`Show ${WIDGET_INFO[w.id].label}`}
                  className="accent-[var(--color-neon)]"
                />
                <span className={`min-w-0 flex-1 ${w.visible && !off ? "" : "opacity-50"}`}>
                  <span className="block font-medium">{WIDGET_INFO[w.id].label}</span>
                  <span className="block text-sm text-court-500">
                    {off
                      ? `${FEATURE_INFO[feature].label} is switched off in Features.`
                      : WIDGET_INFO[w.id].detail}
                  </span>
                </span>
                {t.layout === "columns" && (
                  <button
                    type="button"
                    aria-pressed={w.wide}
                    onClick={() => update(i, { wide: !w.wide })}
                    title={w.wide ? "Spans both columns" : "Takes one column"}
                    className={`rounded-md border px-2 py-1 text-xs ${w.wide ? "border-neon text-neon" : "border-court-700 text-court-300 hover:border-court-500"}`}
                  >
                    {w.wide ? "Wide" : "Half"}
                  </button>
                )}
                <span className="flex flex-col">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move ${WIDGET_INFO[w.id].label} up`}
                    className="px-2 text-court-300 hover:text-neon disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={i === t.widgets.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move ${WIDGET_INFO[w.id].label} down`}
                    className="px-2 text-court-300 hover:text-neon disabled:opacity-20"
                  >
                    ▼
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </SettingsCard>
    </div>
  );
}
