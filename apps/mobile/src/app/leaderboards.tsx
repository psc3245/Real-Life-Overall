import {
  LEADERBOARD_BOARDS,
  LEADERBOARD_MIN_RECAPPED_DAYS,
  type LeaderboardDto,
  type LeaderboardEntryDto,
  type LeaderboardScope,
} from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLeaderboard } from "@/api/social";
import { Chip, Segmented } from "@/components/controls";
import { Card, ErrorNote, Label, Loading, Muted, Screen, TextLink } from "@/components/ui";
import { colors, fonts, space, tierColor } from "@/lib/theme";

export default function LeaderboardsScreen() {
  const [scope, setScope] = useState<LeaderboardScope>("friends");
  const [board, setBoard] = useState("overall");
  const leaderboard = useLeaderboard(scope, board);

  return (
    <Screen
      eyebrow={leaderboard.data ? `Season ${leaderboard.data.seasonLabel}` : "Social"}
      title="Leaderboards"
      onRefresh={() => leaderboard.refetch()}
    >
      <Segmented
        label="Scope"
        options={[
          { value: "friends", label: "Friends" },
          { value: "global", label: "Global" },
        ]}
        value={scope}
        onChange={setScope}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {LEADERBOARD_BOARDS.map((b) => (
          <Chip
            key={b.key}
            label={b.name}
            selected={board === b.key}
            onPress={() => setBoard(b.key)}
          />
        ))}
      </ScrollView>

      {leaderboard.isPending && <Loading />}
      <ErrorNote error={leaderboard.error} onRetry={() => void leaderboard.refetch()} />
      {leaderboard.data && (
        <>
          {scope === "global" && !leaderboard.data.me && (
            <GlobalStatus status={leaderboard.data.globalStatus} />
          )}
          <Board data={leaderboard.data} />
        </>
      )}
    </Screen>
  );
}

function Board({ data }: { data: LeaderboardDto }) {
  if (!data.entries.length) {
    return (
      <Card>
        <Muted style={{ textAlign: "center" }}>
          {data.scope === "friends"
            ? data.board === "overall"
              ? "Add friends to see how you stack up."
              : "Nobody here has this template category."
            : "Nobody is on this board yet this season."}
        </Muted>
      </Card>
    );
  }
  const meBelow = data.me && !data.entries.some((e) => e.isMe);
  return (
    <View style={{ gap: space.sm }}>
      {data.entries.map((e) => (
        <EntryRow key={e.username} entry={e} />
      ))}
      {meBelow && (
        <>
          <Text style={{ textAlign: "center", color: colors.court700 }}>⋯</Text>
          <EntryRow entry={data.me!} />
        </>
      )}
    </View>
  );
}

function EntryRow({ entry }: { entry: LeaderboardEntryDto }) {
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: "/u/[username]", params: { username: entry.username } })
      }
    >
      <Card style={[styles.entry, entry.isMe && styles.me]}>
        <Text style={[styles.rank, entry.rank <= 3 && { color: colors.court100 }]}>
          {entry.rank}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.displayName}
            {entry.isMe && <Text style={{ color: colors.neon, fontSize: 12 }}> YOU</Text>}
          </Text>
          <Muted numberOfLines={1} style={{ fontSize: 13, color: colors.court500 }}>
            {entry.archetype ?? `@${entry.username}`}
            {entry.provisional && " · PROVISIONAL"}
          </Muted>
        </View>
        <Text style={[styles.value, { color: tierColor(entry.value) }]}>
          {entry.value.toFixed(1)}
        </Text>
      </Card>
    </Pressable>
  );
}

/** What stands between you and the global board. */
function GlobalStatus({ status }: { status: LeaderboardDto["globalStatus"] }) {
  const steps: string[] = [];
  if (status.visibility !== "public") steps.push("Make your profile public.");
  if (!status.optedIn) steps.push("Opt in to global leaderboards.");
  if (!status.hasCard) steps.push("Finish onboarding to get a rating.");
  if (status.reasons.includes("few-recaps")) {
    steps.push(
      `Recap at least ${LEADERBOARD_MIN_RECAPPED_DAYS} days this season (you have ${status.recappedDays}).`,
    );
  }
  if (status.reasons.includes("flagged")) {
    steps.push(
      "Many of your recaps had claims the model flagged as implausible or unclear. Log specifics to get back on.",
    );
  }
  if (!steps.length) return null;
  return (
    <Card style={{ gap: space.sm }}>
      <Label>You&apos;re not on this board</Label>
      {steps.map((s) => (
        <Muted key={s}>• {s}</Muted>
      ))}
      {(status.visibility !== "public" || !status.optedIn) && (
        <TextLink href="/me">Sharing settings →</TextLink>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm },
  entry: { flexDirection: "row", alignItems: "center", gap: space.md },
  me: { borderColor: "rgba(60,242,200,0.6)", backgroundColor: "rgba(60,242,200,0.05)" },
  rank: {
    width: 32,
    textAlign: "center",
    color: colors.court500,
    fontFamily: fonts.heavy,
    fontSize: 24,
  },
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  value: { fontFamily: fonts.heavy, fontSize: 28 },
});
