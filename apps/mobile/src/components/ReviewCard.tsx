import {
  HABIT_TYPE_LABELS,
  WEEKDAY_SHORT,
  type HabitProposalDto,
  type WeeklyReviewDto,
  type WeeklyStateDto,
} from "@rlo/shared";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useResolveProposal, useWeeklyReview } from "@/api/weekly";
import { shortDate } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { EarnedBadges } from "./badges";
import { Delta } from "./Delta";
import { NodeChip } from "./NodeChip";
import { OvrChange } from "./RecapPanel";
import { Body, Button, Card, ErrorNote, Label, Loading, Muted } from "./ui";

/** A weekly review in full: narrative, archetype, focus, proposals, adjustments, decay. */
export function ReviewCard({
  review,
  names,
}: {
  review: WeeklyReviewDto;
  names: Map<string, string>;
}) {
  return (
    <Card style={styles.card}>
      <View style={{ gap: space.xs }}>
        <Text style={styles.title}>The week</Text>
        <OvrChange before={review.overallStart} after={review.overallEnd} />
      </View>
      <Body>{review.narrative}</Body>
      <EarnedBadges badges={review.badges} />
      {review.archetypeChange && (
        <View style={styles.archetype}>
          <Text style={{ color: colors.court100, fontSize: 14, lineHeight: 20 }}>
            <Text style={styles.archetypeLabel}>New archetype: </Text>
            {review.archetypeChange.from && (
              <Text style={styles.struck}>{review.archetypeChange.from}</Text>
            )}{" "}
            <Text style={{ fontWeight: "700" }}>{review.archetypeChange.to}</Text>.{" "}
            <Text style={{ color: colors.court300 }}>{review.archetypeChange.description}</Text>
          </Text>
        </View>
      )}

      {review.focusGoals.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Next week&apos;s focus</Label>
          {review.focusGoals.map((g, i) => (
            <View key={g.title} style={styles.goal}>
              <Text style={styles.goalIndex}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Body style={{ fontWeight: "600" }}>{g.title}</Body>
                <Muted>{g.detail}</Muted>
                {g.nodeIds.length > 0 && (
                  <View style={styles.chips}>
                    {g.nodeIds.map((id) => (
                      <NodeChip key={id} id={id} name={names.get(id)} />
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {review.habitProposals.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Suggested habits</Label>
          {review.habitProposals.map((p) => (
            <Proposal key={p.index} reviewId={review.id} proposal={p} names={names} />
          ))}
        </View>
      )}

      {review.corrections.length > 0 && (
        <View>
          <Label>Weekly adjustments</Label>
          {review.corrections.map((c) => (
            <View key={c.nodeId} style={styles.change}>
              <Delta value={c.delta} style={{ width: 52, fontSize: 18 }} />
              <View style={{ flex: 1 }}>
                <Link
                  href={{ pathname: "/node/[id]", params: { id: c.nodeId } }}
                  style={styles.changeName}
                >
                  {c.nodeName}
                </Link>
                <Muted>{c.reason}</Muted>
              </View>
            </View>
          ))}
        </View>
      )}

      {review.decayRevisions.length > 0 && (
        <View style={{ gap: space.xs }}>
          <Label>Decay rule changes</Label>
          {review.decayRevisions.map((d) => (
            <Muted key={d.nodeId}>
              <Text style={{ color: colors.court100, fontWeight: "600" }}>{d.nodeName}:</Text> fades{" "}
              {d.perDay}/day after {d.graceDays} idle days, floor {d.floor}. {d.reason}
            </Muted>
          ))}
        </View>
      )}
    </Card>
  );
}

function Proposal({
  reviewId,
  proposal: p,
  names,
}: {
  reviewId: string;
  proposal: HabitProposalDto;
  names: Map<string, string>;
}) {
  const resolve = useResolveProposal();
  const schedule =
    p.days.length === 7 ? "every day" : p.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
  const goal =
    p.target !== null && (p.type === "counter" || p.type === "duration")
      ? ` · goal ${p.target} ${p.type === "duration" ? "min" : (p.unit ?? "")}`
      : "";
  return (
    <View style={styles.proposal}>
      <Body style={{ fontWeight: "600" }}>{p.name}</Body>
      <Muted style={{ fontSize: 13, color: colors.court500 }}>
        {HABIT_TYPE_LABELS[p.type]} · {schedule}
        {goal}
        {p.nodeIds.length > 0 && ` · ${p.nodeIds.map((id) => names.get(id) ?? "?").join(", ")}`}
      </Muted>
      <Muted>{p.reason}</Muted>
      <ErrorNote error={resolve.error} />
      {p.status === "pending" ? (
        <View style={styles.proposalActions}>
          <View style={{ flex: 1 }}>
            <Button
              title="Add habit"
              disabled={resolve.isPending}
              onPress={() => resolve.mutate({ id: reviewId, index: p.index, action: "accept" })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="No thanks"
              variant="ghost"
              disabled={resolve.isPending}
              onPress={() => resolve.mutate({ id: reviewId, index: p.index, action: "dismiss" })}
            />
          </View>
        </View>
      ) : (
        <Label>{p.status === "accepted" ? "✓ Added" : "Dismissed"}</Label>
      )}
    </View>
  );
}

/** An earlier week's narrative that opens into its full review. */
export function EarlierWeek({
  week: h,
  names,
}: {
  week: WeeklyStateDto["history"][number];
  names: Map<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const review = useWeeklyReview(open ? h.id : null);
  return (
    <Card style={{ gap: space.sm }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ gap: space.xs }}>
        <View style={styles.earlierHead}>
          <Label>
            {shortDate(h.weekStart)} – {shortDate(h.weekEnd)}
          </Label>
          <Muted style={{ fontSize: 12 }}>{open ? "Hide ▲" : "Full review ▼"}</Muted>
        </View>
        {!open && <Muted>{h.narrative}</Muted>}
      </Pressable>
      {open && review.isPending && <Loading />}
      <ErrorNote error={review.error} />
      {open && review.data && <ReviewCard review={review.data} names={names} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg, borderColor: "rgba(60,242,200,0.4)" },
  title: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  archetype: {
    borderWidth: 1,
    borderColor: "rgba(60,242,200,0.4)",
    backgroundColor: "rgba(60,242,200,0.05)",
    borderRadius: 10,
    padding: space.md,
  },
  archetypeLabel: {
    color: colors.neon,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  struck: { color: colors.court500, textDecorationLine: "line-through" },
  goal: { flexDirection: "row", gap: space.md },
  goalIndex: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 22, width: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
  proposal: {
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 10,
    padding: space.md,
  },
  proposalActions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  change: {
    flexDirection: "row",
    gap: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court800,
  },
  changeName: { color: colors.court100, fontSize: 16, fontWeight: "600" },
  earlierHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
});
