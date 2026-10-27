import type { FriendDto } from "@rlo/shared";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFriendAction, useFriends } from "@/api/social";
import { OvrBadge } from "@/components/ratings";
import { Button, Card, ErrorNote, Field, Label, Loading, Muted, Screen } from "@/components/ui";
import { colors, fonts, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

function FriendsScreen() {
  const friends = useFriends();
  const action = useFriendAction();
  const [username, setUsername] = useState("");

  const add = () => {
    const name = username.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    action.mutate({ username: name, action: "add" }, { onSuccess: () => setUsername("") });
  };

  return (
    <Screen eyebrow="Social" title="Friends" onRefresh={() => friends.refetch()}>
      <View style={styles.add}>
        <Field
          value={username}
          onChangeText={setUsername}
          placeholder="Their username"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={add}
          style={{ flex: 1 }}
        />
        <Button title="Add" disabled={!username.trim() || action.isPending} onPress={add} />
      </View>
      <ErrorNote error={action.error} />
      {action.isSuccess && action.data.state === "outgoing" && (
        <Text style={{ color: colors.neon }}>Request sent.</Text>
      )}

      {friends.isPending && <Loading />}
      <ErrorNote error={friends.error} />
      {friends.data && (
        <>
          {friends.data.incoming.length > 0 && (
            <Group title="Requests">
              {friends.data.incoming.map((f) => (
                <Row key={f.username} friend={f}>
                  <Button
                    title="Accept"
                    disabled={action.isPending}
                    onPress={() => action.mutate({ username: f.username, action: "add" })}
                  />
                  <Button
                    title="Decline"
                    variant="ghost"
                    disabled={action.isPending}
                    onPress={() => action.mutate({ username: f.username, action: "remove" })}
                  />
                </Row>
              ))}
            </Group>
          )}

          <Group title={`Friends (${friends.data.friends.length})`}>
            {friends.data.friends.length === 0 && (
              <Muted>
                No friends yet. Add someone by username, or share your profile link from the You
                tab.
              </Muted>
            )}
            {friends.data.friends.map((f) => (
              <Row key={f.username} friend={f}>
                {f.card && (
                  <Button
                    title="Compare"
                    variant="ghost"
                    onPress={() =>
                      router.push({
                        pathname: "/compare/[username]",
                        params: { username: f.username },
                      })
                    }
                  />
                )}
              </Row>
            ))}
          </Group>

          {friends.data.outgoing.length > 0 && (
            <Group title="Sent">
              {friends.data.outgoing.map((f) => (
                <Row key={f.username} friend={f}>
                  <Button
                    title="Cancel"
                    variant="ghost"
                    disabled={action.isPending}
                    onPress={() => action.mutate({ username: f.username, action: "remove" })}
                  />
                </Row>
              ))}
            </Group>
          )}
        </>
      )}
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{title}</Label>
      {children}
    </View>
  );
}

function Row({ friend, children }: { friend: FriendDto; children?: ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <Pressable
        style={styles.row}
        onPress={() =>
          router.push({ pathname: "/u/[username]", params: { username: friend.username } })
        }
      >
        {friend.card ? (
          <OvrBadge value={friend.card.overall} size={44} />
        ) : (
          <View style={styles.empty}>
            <Text style={{ color: colors.court500, fontFamily: fonts.display, fontSize: 20 }}>
              –
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {friend.displayName}
          </Text>
          <Muted numberOfLines={1} style={{ fontSize: 13, color: colors.court500 }}>
            @{friend.username}
            {friend.card?.archetype && ` · ${friend.card.archetype}`}
          </Muted>
        </View>
      </Pressable>
      {children && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  add: { flexDirection: "row", gap: space.sm, alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: space.lg },
  empty: {
    width: 57,
    height: 57,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.court700,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    textTransform: "uppercase",
  },
  actions: { flexDirection: "row", gap: space.sm },
});

export default function GatedFriendsScreen() {
  return (
    <FeatureGate feature="friends">
      <FriendsScreen />
    </FeatureGate>
  );
}
