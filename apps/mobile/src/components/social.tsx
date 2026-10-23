import type { FriendshipState } from "@rlo/shared";
import { router } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import { useFriendAction } from "@/api/social";
import { WEB_URL } from "@/lib/config";
import { colors, space } from "@/lib/theme";
import { Button, ErrorNote } from "./ui";

export const VISIBILITY_LABEL = {
  private: "Private: only you",
  friends: "Friends only",
  public: "Public: anyone with the link",
} as const;

export const profileUrl = (username: string) => `${WEB_URL}/u/${username}`;

/** Opens the iOS share sheet with a profile link (the web's "Copy link"). */
export function ShareLink({ username }: { username: string }) {
  return (
    <Button
      title="Share profile link"
      variant="ghost"
      onPress={() => void Share.share({ url: profileUrl(username) })}
    />
  );
}

/** The friend actions for one player, matching where the two of you stand. */
export function FriendButtons({
  username,
  state,
  canCompare,
}: {
  username: string;
  state: FriendshipState;
  canCompare: boolean;
}) {
  const action = useFriendAction();
  const run = (a: "add" | "remove") => action.mutate({ username, action: a });
  const busy = action.isPending;
  const compare = () => router.push({ pathname: "/compare/[username]", params: { username } });
  return (
    <View style={{ gap: space.sm }}>
      {state === "none" && <Button title="Add friend" disabled={busy} onPress={() => run("add")} />}
      {state === "outgoing" && (
        <View style={styles.row}>
          <Text style={styles.note}>Request sent</Text>
          <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => run("remove")} />
        </View>
      )}
      {state === "incoming" && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button title="Accept request" disabled={busy} onPress={() => run("add")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Decline" variant="ghost" disabled={busy} onPress={() => run("remove")} />
          </View>
        </View>
      )}
      {state === "friends" && <Text style={[styles.note, { color: colors.neon }]}>✓ Friends</Text>}
      {canCompare && <Button title="Compare" variant="ghost" onPress={compare} />}
      {state === "friends" && (
        <Button
          title="Remove friend"
          variant="ghost"
          disabled={busy}
          onPress={() => run("remove")}
        />
      )}
      <ErrorNote error={action.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  note: { color: colors.court300, fontSize: 15 },
});
