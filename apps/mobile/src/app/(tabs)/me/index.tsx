import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { getDevUser, setDevUser } from "@/api/client";
import { useMe } from "@/api/hooks";
import { useAuthState, useSignOut } from "@/api/session";
import { Body, Button, Card, Label, Muted, Screen } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { colors, space } from "@/lib/theme";

export default function MeScreen() {
  const auth = useAuthState();
  const me = useMe();
  const signOut = useSignOut();

  return (
    <Screen title="You" onRefresh={() => void me.refetch()} refreshing={me.isRefetching}>
      <View style={styles.section}>
        <Label>Player</Label>
        <Card style={styles.card}>
          <Body>{me.data?.displayName ?? "…"}</Body>
          {me.data && <Muted>@{me.data.username}</Muted>}
          {auth.mode === "better-auth" && auth.user && <Muted>{auth.user.email}</Muted>}
        </Card>
      </View>

      {auth.mode === "dev" && <DevUser />}

      <View style={styles.section}>
        <Label>Server</Label>
        <Card style={styles.card}>
          <Muted>{API_URL}</Muted>
          <Muted>Auth: {auth.mode === "dev" ? "dev (x-dev-user)" : "Better Auth"}</Muted>
        </Card>
      </View>

      {auth.mode === "better-auth" && (
        <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
      )}
    </Screen>
  );
}

/** AUTH_MODE=dev only: switch which dev player the API sees (e.g. "demo"). */
function DevUser() {
  const queryClient = useQueryClient();
  const [name, setName] = useState(getDevUser());
  const apply = () => {
    const next = name.trim().toLowerCase() || "dev";
    setDevUser(next);
    setName(next);
    void queryClient.invalidateQueries();
  };
  return (
    <View style={styles.section}>
      <Label>Dev user</Label>
      <Card style={styles.card}>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={apply}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />
        <Button title="Switch" variant="ghost" onPress={apply} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  card: { gap: space.sm },
  input: {
    color: colors.court100,
    fontSize: 16,
    borderBottomColor: colors.court500,
    borderBottomWidth: 1,
    paddingVertical: space.sm,
  },
});
