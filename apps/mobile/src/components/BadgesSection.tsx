import {
  BADGE_TIER_LABELS,
  BADGE_TIERS,
  type BadgeProgressDto,
  type EarnedBadgeDto,
} from "@rlo/shared";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useBadges } from "@/api/badges";
import { formatNumber, instantDate } from "@/lib/format";
import { colors, fonts, space } from "@/lib/theme";
import { Medallion, TIER_COLORS } from "./badges";
import { Body, Button, Card, Label, Muted } from "./ui";

/** Catalog badges with tier progress, plus personal badges; tap one for its ladder. */
export function BadgesSection() {
  const badges = useBadges();
  const [open, setOpen] = useState<string | null>(null);
  if (!badges.data) return null;
  const { progress, personal } = badges.data;
  const openCatalog = progress.find((b) => b.key === open);
  const openPersonal = personal.find((b) => b.key === open);

  return (
    <View style={{ gap: space.md }}>
      <Label>Badges</Label>
      <View style={styles.grid}>
        {progress.map((b) => {
          const share = b.next ? Math.min(1, b.value / b.next) : 1;
          const color = b.tier ? TIER_COLORS[b.tier] : colors.court500;
          return (
            <Pressable key={b.key} onPress={() => setOpen(b.key)} style={styles.tile}>
              <Card style={[{ gap: space.sm, flex: 1 }, !b.tier && { opacity: 0.8 }]}>
                <View style={styles.tileHead}>
                  <Medallion tier={b.tier} locked={!b.tier} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>
                      {b.name}
                    </Text>
                    <Text style={styles.tier}>
                      {b.tier ? BADGE_TIER_LABELS[b.tier] : "Not earned yet"}
                    </Text>
                  </View>
                </View>
                <View style={styles.bar}>
                  <View
                    style={[styles.barFill, { width: `${share * 100}%`, backgroundColor: color }]}
                  />
                </View>
                <Text style={styles.count}>
                  {b.next
                    ? `${formatNumber(b.value)} / ${formatNumber(b.next)} ${b.unit}`
                    : `${formatNumber(b.value)} ${b.unit} · maxed`}
                </Text>
              </Card>
            </Pressable>
          );
        })}
      </View>
      {personal.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Personal</Label>
          {personal.map((b) => (
            <Pressable key={b.key} onPress={() => setOpen(b.key)}>
              <Card style={[styles.personal]}>
                <Medallion tier={null} size={30} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "600" }}>{b.name}</Body>
                  <Muted>{b.description}</Muted>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
      <Modal
        visible={Boolean(openCatalog || openPersonal)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(null)}
      >
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={{ gap: space.lg, padding: space.xl }}
        >
          {openCatalog && <CatalogDetail badge={openCatalog} />}
          {openPersonal && <PersonalDetail badge={openPersonal} />}
          <Button title="Close" variant="ghost" onPress={() => setOpen(null)} />
        </ScrollView>
      </Modal>
    </View>
  );
}

function DetailHeader({
  tier,
  locked = false,
  title,
  subtitle,
}: {
  tier: BadgeProgressDto["tier"];
  locked?: boolean;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.detailHead}>
      <Medallion tier={tier} size={52} locked={locked} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={styles.tier}>{subtitle}</Text>
      </View>
    </View>
  );
}

/** A catalog badge's ladder: each tier's bar, when it was earned, and how far to the next. */
function CatalogDetail({ badge: b }: { badge: BadgeProgressDto }) {
  const earned = new Map(b.earned.map((e) => [e.tier, e.earnedAt]));
  const nextIndex = b.tier ? BADGE_TIERS.indexOf(b.tier) + 1 : 0;
  return (
    <>
      <DetailHeader
        tier={b.tier}
        locked={!b.tier}
        title={b.name}
        subtitle={b.tier ? `${BADGE_TIER_LABELS[b.tier]} reached` : "Not earned yet"}
      />
      <Muted>{b.description}</Muted>
      <Text style={styles.big}>
        {formatNumber(b.value)}{" "}
        <Text style={{ fontSize: 16, color: colors.court500 }}>{b.unit}</Text>
      </Text>
      {BADGE_TIERS.map((tier, i) => {
        const threshold = b.thresholds[i]!;
        const done = i < nextIndex;
        const isNext = i === nextIndex;
        const share = done ? 1 : Math.min(1, b.value / threshold);
        return (
          <View key={tier} style={[{ gap: space.xs }, !done && !isNext && { opacity: 0.6 }]}>
            <View style={styles.tierRow}>
              <Medallion tier={tier} size={22} locked={!done} />
              <Body style={{ fontWeight: "600" }}>{BADGE_TIER_LABELS[tier]}</Body>
              <Muted style={{ color: colors.court500 }}>
                {formatNumber(threshold)} {b.unit}
              </Muted>
              <Muted style={{ marginLeft: "auto", fontSize: 12 }}>
                {done
                  ? earned.get(tier)
                    ? `Earned ${instantDate(earned.get(tier)!)}`
                    : "Earned"
                  : isNext
                    ? `${formatNumber(Math.max(0, threshold - b.value))} to go`
                    : "Locked"}
              </Muted>
            </View>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${share * 100}%`, backgroundColor: TIER_COLORS[tier] },
                ]}
              />
            </View>
          </View>
        );
      })}
      <Card>
        <Muted>
          <Text style={styles.hintLabel}>How to progress: </Text>
          {b.hint}
        </Muted>
      </Card>
    </>
  );
}

function PersonalDetail({ badge: b }: { badge: EarnedBadgeDto }) {
  return (
    <>
      <DetailHeader
        tier={null}
        title={b.name}
        subtitle={`Personal badge · earned ${instantDate(b.earnedAt)}`}
      />
      <Body>{b.description}</Body>
      <Muted>
        Personal badges are awarded by your weekly reviews for something specific to you. They have
        no tiers and don&apos;t appear on your shared card.
      </Muted>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { flexBasis: "47%", flexGrow: 1 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { color: colors.court100, fontSize: 15, fontWeight: "600" },
  tier: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.court700, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  count: { color: colors.court500, fontSize: 12 },
  personal: { flexDirection: "row", alignItems: "center", gap: space.md },
  sheet: { flex: 1, backgroundColor: colors.court950 },
  detailHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  detailTitle: {
    color: colors.court100,
    fontFamily: fonts.heavy,
    fontSize: 26,
    textTransform: "uppercase",
  },
  big: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 32 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  hintLabel: {
    color: colors.neon,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
