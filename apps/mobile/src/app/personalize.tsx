import {
  DEFAULT_PREFERENCES,
  FEATURES,
  MOTIONS,
  SPORTS_TALK_INFO,
  SPORTS_TALK_LEVELS,
  START_PAGES,
  TIER_PALETTES,
  TODAY_WIDGET_FEATURE,
  type Preferences,
  type StartPage,
  type TodayPreferences,
} from "@rlo/shared";
import { useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMe } from "@/api/hooks";
import { usePreferences, useSetPreferences } from "@/api/preferences";
import { Chip, Segmented } from "@/components/controls";
import { SaveStatus, SettingRow, SettingsGroup, ToggleRow } from "@/components/settings";
import { Muted, Screen } from "@/components/ui";
import { FEATURE_GROUPS, FEATURE_INFO, WIDGET_INFO } from "@/lib/featureInfo";
import { useTalk } from "@/lib/talk";
import { colors, space } from "@/lib/theme";

type Tab = "behavior" | "today" | "features";
const TABS: { value: Tab; label: string }[] = [
  { value: "behavior", label: "Behavior" },
  { value: "today", label: "Today" },
  { value: "features", label: "Features" },
];

const START_LABEL: Record<StartPage, string> = {
  home: "Today",
  today: "Today",
  log: "Day log",
  ratings: "Ratings",
  habits: "Habits",
};
const MOTION_LABEL: Record<Preferences["motion"], string> = {
  full: "Always",
  system: "Follow iOS",
  off: "Off",
};

/**
 * The web's Personalize modal. Preferences live on the account, so changes here show on the web
 * and back. The web's look options (themes, fonts, density) style the website only.
 */
export default function PersonalizeScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? "behavior");
  return (
    <Screen title="Personalize">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Segmented label="Section" options={TABS} value={tab} onChange={setTab} />
        <SaveStatus />
      </View>
      {tab === "behavior" && <Behavior />}
      {tab === "today" && <TodaySettings />}
      {tab === "features" && <Features />}
    </Screen>
  );
}

function Behavior() {
  const prefs = usePreferences();
  const set = useSetPreferences();
  return (
    <>
      <SettingsGroup
        title="Sports talk"
        footer={`${SPORTS_TALK_INFO[prefs.sportsTalk].detail} Changes the app's wording and how the AI writes your recaps, reviews and coach replies.`}
      >
        <SettingRow label="How much game talk" stacked last>
          <Segmented
            label="Sports talk"
            value={prefs.sportsTalk}
            onChange={(sportsTalk) => set({ sportsTalk })}
            options={SPORTS_TALK_LEVELS.map((l) => ({
              value: l,
              label: SPORTS_TALK_INFO[l].label,
            }))}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title="App">
        <SettingRow label="Open the app on" stacked>
          <View style={styles.wrap}>
            {START_PAGES.filter((p) => p !== "home").map((p) => (
              <Chip
                key={p}
                label={START_LABEL[p]}
                selected={(prefs.startPage === "home" ? "today" : prefs.startPage) === p}
                onPress={() => set({ startPage: p })}
              />
            ))}
          </View>
        </SettingRow>
        <SettingRow label="Animations" stacked>
          <Segmented
            label="Animations"
            value={prefs.motion}
            onChange={(motion) => set({ motion })}
            options={MOTIONS.map((m) => ({ value: m, label: MOTION_LABEL[m] }))}
          />
        </SettingRow>
        <SettingRow
          label="Rating colors"
          detail="Colorblind-friendly swaps red and green for orange and blue."
          stacked
          last
        >
          <Segmented
            label="Rating colors"
            value={prefs.tierPalette}
            onChange={(tierPalette) => set({ tierPalette })}
            options={TIER_PALETTES.map((p) => ({
              value: p,
              label: p === "classic" ? "Classic" : "Colorblind",
            }))}
          />
        </SettingRow>
      </SettingsGroup>
      <Muted style={{ fontSize: 12, color: colors.court500 }}>
        Theme, accent color, fonts and layout are set on the website and style the website; the app
        keeps the iOS look.
      </Muted>
    </>
  );
}

function TodaySettings() {
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
  const update = (index: number, changes: { visible?: boolean }) =>
    set({ widgets: t.widgets.map((w, i) => (i === index ? { ...w, ...changes } : w)) });
  const isDefault = JSON.stringify(t) === JSON.stringify(DEFAULT_PREFERENCES.today);

  return (
    <>
      <SettingsGroup
        title="Today page"
        action={
          !isDefault && (
            <Pressable
              onPress={() => setPreferences({ today: DEFAULT_PREFERENCES.today })}
              hitSlop={6}
            >
              <Text style={{ color: colors.neon, fontSize: 13 }}>Reset</Text>
            </Pressable>
          )
        }
      >
        <SettingRow label="Goals shown" stacked>
          <Segmented
            label="Goals shown"
            value={String(t.goalsShown)}
            onChange={(v) => set({ goalsShown: Number(v) })}
            options={[2, 4, 6, 10].map((n) => ({ value: String(n), label: String(n) }))}
          />
        </SettingRow>
        <SettingRow label="Rating movers shown" stacked>
          <Segmented
            label="Rating movers shown"
            value={String(t.moversShown)}
            onChange={(v) => set({ moversShown: Number(v) })}
            options={[0, 2, 4, 6].map((n) => ({ value: String(n), label: n ? String(n) : "None" }))}
          />
        </SettingRow>
        <ToggleRow
          label="Greet me by name"
          detail={`A greeting like "Evening, ${firstName}" instead of "Today" as the title.`}
          value={t.greeting}
          onChange={(greeting) => set({ greeting })}
        />
        <ToggleRow
          label="Show the Log today button"
          value={t.showLogButton}
          onChange={(showLogButton) => set({ showLogButton })}
        />
        <ToggleRow
          label="Hide finished habits"
          detail="The habits card lists only what's left; the count still shows everything."
          value={t.hideDoneHabits}
          onChange={(hideDoneHabits) => set({ hideDoneHabits })}
          last
        />
      </SettingsGroup>
      <SettingsGroup
        title="Widgets"
        footer="Top to bottom. The web's half/wide setting only affects its two-column layout."
      >
        {t.widgets.map((w, i) => {
          const feature = TODAY_WIDGET_FEATURE[w.id];
          const off = feature !== undefined && !prefs.features[feature];
          const shown = w.visible && !off;
          return (
            <View key={w.id} style={[styles.widget, i > 0 && styles.border]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: shown, disabled: off }}
                accessibilityLabel={`Show ${WIDGET_INFO[w.id].label}`}
                disabled={off}
                onPress={() => update(i, { visible: !w.visible })}
                style={{ flexDirection: "row", gap: space.md, flex: 1, alignItems: "center" }}
              >
                <SymbolView
                  name={shown ? "checkmark.circle.fill" : "circle"}
                  tintColor={shown ? colors.neon : colors.court500}
                  size={22}
                />
                <View style={{ flex: 1, opacity: shown ? 1 : 0.5 }}>
                  <Text style={{ color: colors.court100, fontSize: 16 }}>
                    {WIDGET_INFO[w.id].label}
                  </Text>
                  <Muted style={{ fontSize: 12 }}>
                    {off
                      ? `${FEATURE_INFO[feature].label} is switched off in Features.`
                      : WIDGET_INFO[w.id].detail}
                  </Muted>
                </View>
              </Pressable>
              <View>
                <Arrow
                  symbol="chevron.up"
                  label={`Move ${WIDGET_INFO[w.id].label} up`}
                  disabled={i === 0}
                  onPress={() => move(i, -1)}
                />
                <Arrow
                  symbol="chevron.down"
                  label={`Move ${WIDGET_INFO[w.id].label} down`}
                  disabled={i === t.widgets.length - 1}
                  onPress={() => move(i, 1)}
                />
              </View>
            </View>
          );
        })}
      </SettingsGroup>
    </>
  );
}

function Arrow({
  symbol,
  label,
  disabled,
  onPress,
}: {
  symbol: "chevron.up" | "chevron.down";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={{ padding: 4, opacity: disabled ? 0.2 : 1 }}
    >
      <SymbolView name={symbol} tintColor={colors.court300} size={14} />
    </Pressable>
  );
}

function Features() {
  const talk = useTalk();
  const prefs = usePreferences();
  const set = useSetPreferences();
  const allOn = FEATURES.every((f) => prefs.features[f]);
  return (
    <>
      <Muted>
        Only use part of the app? Switch the rest off to hide its screens, Today widgets and day-log
        sections, here and on the web. Nothing is deleted, and recaps still see everything
        you&apos;ve logged. Ratings, Today and the day log are always on.
      </Muted>
      {!allOn && (
        <Pressable onPress={() => set({ features: DEFAULT_PREFERENCES.features })} hitSlop={6}>
          <Text style={{ color: colors.neon, fontSize: 14 }}>Turn everything on</Text>
        </Pressable>
      )}
      {FEATURE_GROUPS.map((group) => (
        <SettingsGroup key={group.label} title={group.label}>
          {group.features.map((f, i) => (
            <ToggleRow
              key={f}
              // One feature per patch: the API merges them, so another device's toggle survives.
              onChange={(on) => set({ features: { [f]: on } })}
              value={prefs.features[f]}
              label={f === "coach" ? talk.coach : FEATURE_INFO[f].label}
              detail={FEATURE_INFO[f].detail}
              last={i === group.features.length - 1}
            />
          ))}
        </SettingsGroup>
      ))}
      <Muted style={{ fontSize: 12, color: colors.court500 }}>
        Weight and height tracking are switched on in Settings, under Units & body.
      </Muted>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  widget: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 8,
  },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
});
