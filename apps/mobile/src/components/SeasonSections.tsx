import { Link, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSeasonCards, useSeasonSetup } from "@/api/seasons";
import { colors, fonts, space } from "@/lib/theme";
import { OvrBadge } from "./ratings";
import { Button, Card, Label, Muted, TextLink } from "./ui";

/** Shown while a freshly rolled season can still be reshaped. */
export function NewSeasonBanner() {
  const setup = useSeasonSetup();
  if (!setup.data?.editable) return null;
  return (
    <Card style={styles.banner}>
      <Text style={{ color: colors.court100, fontSize: 14, lineHeight: 20 }}>
        <Text style={styles.bannerTitle}>Season {setup.data.label} has begun. </Text>
        <Text style={{ color: colors.court300 }}>
          Your ratings carried over. You can reshape your categories until {setup.data.setupEndsOn}.
        </Text>
      </Text>
      <Button title="Season setup" onPress={() => router.push("/season-setup")} />
    </Card>
  );
}

export function PastSeasons() {
  const cards = useSeasonCards();
  if (!cards.data?.length) return null;
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.head}>
        <Label>Past seasons</Label>
        <TextLink href="/history">All seasons →</TextLink>
      </View>
      {cards.data.map((c) => {
        const categories = c.nodes.filter((n) => n.depth === 1);
        return (
          <Link key={c.id} href={{ pathname: "/history/[id]", params: { id: c.id } }} asChild>
            <Pressable>
              <Card style={styles.season}>
                {c.overall !== null && <OvrBadge value={c.overall} size={48} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>{c.label}</Text>
                  {c.archetype && <Muted numberOfLines={1}>{c.archetype}</Muted>}
                  <Muted style={{ fontSize: 13, color: colors.court500 }}>
                    {categories
                      .map((n) => `${n.name} ${n.value === null ? "–" : n.value.toFixed(0)}`)
                      .join(" · ")}
                  </Muted>
                </View>
              </Card>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: space.md,
    borderColor: "rgba(60,242,200,0.4)",
    backgroundColor: "rgba(60,242,200,0.05)",
  },
  bannerTitle: {
    color: colors.neon,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  season: { flexDirection: "row", alignItems: "center", gap: space.lg },
  label: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
