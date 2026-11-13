import { MAX_HABIT_BUCKETS, type HabitBucketDto } from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { ActionSheetIOS, Alert, Pressable, StyleSheet, View } from "react-native";
import { useCreateBucket, useDeleteBucket, useRenameBucket, useReorderBuckets } from "@/api/days";
import { colors, space } from "@/lib/theme";
import { Body, Button, Card, ErrorNote, Label, Muted } from "./ui";

/** Make, rename, reorder and delete the buckets habits are filed into (as on the web). */
export function BucketsCard({ buckets }: { buckets: HabitBucketDto[] }) {
  const create = useCreateBucket();
  const rename = useRenameBucket();
  const reorder = useReorderBuckets();
  const remove = useDeleteBucket();

  const add = () =>
    Alert.prompt("New bucket", "e.g. Morning, Health, Work", (name) => {
      if (name?.trim()) create.mutate(name.trim());
    });
  const move = (i: number, delta: number) => {
    const ids = buckets.map((b) => b.id);
    [ids[i], ids[i + delta]] = [ids[i + delta]!, ids[i]!];
    reorder.mutate(ids);
  };
  const options = (b: HabitBucketDto) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: b.name,
        options: ["Rename", "Delete", "Cancel"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        if (i === 0) {
          Alert.prompt(
            "Rename bucket",
            undefined,
            (name) => name?.trim() && rename.mutate({ id: b.id, name: name.trim() }),
            "plain-text",
            b.name,
          );
        } else if (i === 1) {
          Alert.alert(`Delete ${b.name}?`, "Its habits stay, unfiled.", [
            { text: "Keep", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => remove.mutate(b.id) },
          ]);
        }
      },
    );

  return (
    <Card style={{ gap: space.sm }}>
      <Label>Buckets</Label>
      <Muted style={{ fontSize: 13 }}>
        Sections to file habits into, like Morning or Health. Lists follow this order.
      </Muted>
      {buckets.map((b, i) => (
        <View key={b.id} style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Rename or delete"
            onPress={() => options(b)}
            style={{ flex: 1, paddingVertical: 6 }}
          >
            <Body>{b.name}</Body>
          </Pressable>
          <Arrow
            symbol="chevron.up"
            label={`Move ${b.name} up`}
            disabled={i === 0 || reorder.isPending}
            onPress={() => move(i, -1)}
          />
          <Arrow
            symbol="chevron.down"
            label={`Move ${b.name} down`}
            disabled={i === buckets.length - 1 || reorder.isPending}
            onPress={() => move(i, 1)}
          />
        </View>
      ))}
      {buckets.length < MAX_HABIT_BUCKETS && (
        <Button title="+ Add bucket" variant="ghost" onPress={add} />
      )}
      <ErrorNote error={create.error ?? rename.error ?? reorder.error ?? remove.error} />
    </Card>
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
      hitSlop={6}
      onPress={onPress}
      style={[styles.arrow, disabled && { opacity: 0.3 }]}
    >
      <SymbolView name={symbol} tintColor={colors.court300} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
});
