import type { OnboardingStateDto } from "@rlo/shared";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useMe } from "@/api/hooks";
import { useRateInitial, useRatings } from "@/api/ratings";
import { colors, fonts, space } from "@/lib/theme";
import { OvrBadge, StatBar } from "../ratings";
import { Button, Card, ErrorNote, Loading, Muted } from "../ui";

const WORKING_LINES = [
  "Reviewing your scouting report…",
  "Checking answers against the rating scale…",
  "Weighing strengths and gaps…",
  "Writing your rationales…",
  "Naming your build…",
];

/** Step 5: the button that rates you, then the OVR reveal. */
export function RevealStep({ state }: { state: OnboardingStateDto }) {
  if (state.stage === "complete") return <Reveal />;
  return <ReadyToRate />;
}

function ReadyToRate() {
  const rate = useRateInitial();
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!rate.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING_LINES.length), 3500);
    return () => clearInterval(timer);
  }, [rate.isPending]);

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.big}>Scouting complete</Text>
      <Muted>
        The scouts have everything they need. Your starting ratings are set once and then move with
        what you log.
      </Muted>
      <Button
        title={rate.isPending ? "Rating you…" : "Reveal my rating"}
        disabled={rate.isPending}
        onPress={() => rate.mutate()}
      />
      {rate.isPending && <Muted>{WORKING_LINES[line]} This can take up to a minute.</Muted>}
      <ErrorNote error={rate.error} />
    </Card>
  );
}

/** The OVR counts up, then the archetype and categories land one after another. */
function Reveal() {
  const ratings = useRatings();
  const me = useMe();
  const target = ratings.data?.nodes.find((n) => n.parentId === null)?.value ?? 0;
  const [shown, setShown] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ratings.data) return;
    const start = Date.now();
    const timer = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / 2200);
      setShown(target * (1 - Math.pow(1 - t, 3)));
      if (t === 1) clearInterval(timer);
    }, 30);
    Animated.timing(fade, {
      toValue: 1,
      duration: 700,
      delay: 2300,
      useNativeDriver: true,
    }).start();
    return () => clearInterval(timer);
  }, [ratings.data, target, fade]);

  if (ratings.isPending) return <Loading />;
  if (!ratings.data) return <ErrorNote error={ratings.error ?? new Error("No ratings found")} />;

  const { nodes, archetype, summary } = ratings.data;
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);

  return (
    <View style={{ alignItems: "center", gap: space.xl }}>
      <Text style={styles.eyebrow}>{me.data?.displayName ?? "Your"} rating</Text>
      <OvrBadge value={shown} size={120} />
      <Animated.View style={{ opacity: fade, alignSelf: "stretch", gap: space.lg }}>
        {archetype && (
          <View style={{ alignItems: "center", gap: space.sm }}>
            <Text style={styles.archetype}>{archetype.name}</Text>
            <Muted style={{ textAlign: "center" }}>{archetype.description}</Muted>
          </View>
        )}
        {categories.map((c) => (
          <StatBar key={c.id} label={c.name} value={c.value ?? 0} />
        ))}
        {summary && <Muted style={{ textAlign: "center" }}>{summary}</Muted>}
        <Button title="See full ratings" onPress={() => router.replace("/ratings")} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 28, textTransform: "uppercase" },
  eyebrow: { color: colors.court300, fontSize: 13, letterSpacing: 3, textTransform: "uppercase" },
  archetype: {
    color: colors.neon,
    fontFamily: fonts.heavy,
    fontSize: 34,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
