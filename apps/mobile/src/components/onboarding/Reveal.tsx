import type { OnboardingStateDto } from "@rlo/shared";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useMe } from "@/api/hooks";
import { useSetOnboardingMode } from "@/api/onboarding";
import { useReducedMotion } from "@/lib/motion";
import { useTalk } from "@/lib/talk";
import { useRateInitial, useRatings } from "@/api/ratings";
import { colors, fonts, space } from "@/lib/theme";
import { ModePicker } from "../ModePicker";
import { OvrBadge, StatBar } from "../ratings";
import { useShowRatings } from "../score";
import { Button, Card, ErrorNote, Loading, Muted } from "../ui";

const WORKING_LINES = [
  "Reviewing your answers…",
  "Checking answers against the rating scale…",
  "Weighing strengths and gaps…",
  "Writing your rationales…",
  "Naming your build…",
];

/** Step 5: the button that rates you, then the OVR reveal. */
export function RevealStep({ state }: { state: OnboardingStateDto }) {
  if (state.stage === "complete") return <Reveal />;
  return <ReadyToRate state={state} />;
}

function ReadyToRate({ state }: { state: OnboardingStateDto }) {
  const talk = useTalk();
  const setMode = useSetOnboardingMode();
  const rate = useRateInitial();
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!rate.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING_LINES.length), 3500);
    return () => clearInterval(timer);
  }, [rate.isPending]);

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.big}>{talk.scouting} complete</Text>
      <Muted>
        That&apos;s everything needed. Your starting ratings are set once and then move with what
        you log.
      </Muted>
      <Text style={styles.eyebrow}>How should your season be scored?</Text>
      <ModePicker
        value={state.season.mode}
        disabled={setMode.isPending || rate.isPending}
        onChange={(mode) => setMode.mutate(mode)}
      />
      <Muted style={{ fontSize: 12, textAlign: "center" }}>
        You pick again at the start of every season.
      </Muted>
      <ErrorNote error={setMode.error} />
      <Button
        title={rate.isPending ? "Rating you…" : talk.revealButton}
        disabled={rate.isPending || setMode.isPending}
        onPress={() => rate.mutate()}
      />
      {rate.isPending && <Muted>{WORKING_LINES[line]} This can take up to a minute.</Muted>}
      <ErrorNote error={rate.error} />
    </Card>
  );
}

/**
 * The OVR counts up, then the archetype and categories land one after another. A growth season
 * starts everyone at +0, so the scouting ratings stay behind a toggle (DESIGN.md §4.6).
 */
function Reveal() {
  const talk = useTalk();
  const ratings = useRatings();
  const me = useMe();
  const [showRatings, setShowRatings] = useShowRatings();
  const reduced = useReducedMotion();
  const growth = ratings.data?.season.mode === "growth";
  // Ratings show unless it's a growth season and the player hasn't asked to see them.
  const asRatings = !growth || showRatings;
  const rootNode = ratings.data?.nodes.find((n) => n.parentId === null);
  const target = (asRatings ? rootNode?.rating : rootNode?.value) ?? 0;
  const [shown, setShown] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ratings.data) return;
    if (reduced) {
      setShown(target);
      fade.setValue(1);
      return;
    }
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
  }, [ratings.data, target, fade, reduced]);

  if (ratings.isPending) return <Loading />;
  if (!ratings.data) return <ErrorNote error={ratings.error ?? new Error("No ratings found")} />;

  const { nodes, archetype, summary } = ratings.data;
  const root = nodes.find((n) => n.parentId === null);
  const categories = nodes.filter((n) => n.parentId === root?.id);

  return (
    <View style={{ alignItems: "center", gap: space.xl }}>
      <Text style={styles.eyebrow}>
        {me.data?.displayName ?? "Your"}{" "}
        {growth && !asRatings ? `${talk.growthMode} season` : "rating"}
      </Text>
      <OvrBadge value={shown} size={120} mode={asRatings ? "rating" : "growth"} />
      <Animated.View style={{ opacity: fade, alignSelf: "stretch", gap: space.lg }}>
        {archetype && (
          <View style={{ alignItems: "center", gap: space.sm }}>
            <Text style={styles.archetype}>{archetype.name}</Text>
            <Muted style={{ textAlign: "center" }}>{archetype.description}</Muted>
          </View>
        )}
        {growth && (
          <View style={{ alignItems: "center", gap: space.xs }}>
            <Muted style={{ textAlign: "center" }}>
              You&apos;re playing {talk.growthMode}: everyone starts at +0 and every point you gain
              this season counts. Your scouting ratings keep running underneath, visible only to
              you.
            </Muted>
            <Text
              accessibilityRole="button"
              onPress={() => setShowRatings(!showRatings)}
              style={{
                color: colors.court500,
                fontSize: 12,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {showRatings ? "Hide my ratings" : "Peek at my ratings"}
            </Text>
          </View>
        )}
        {categories.map((c) =>
          asRatings ? (
            <StatBar
              key={c.id}
              label={c.name}
              value={c.rating ?? 0}
              score={{ mode: "rating", max: 100 }}
            />
          ) : (
            <StatBar key={c.id} label={c.name} value={c.value ?? 0} />
          ),
        )}
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
