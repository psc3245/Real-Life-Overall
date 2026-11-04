import { MAX_BUG_REPORT } from "@rlo/shared";
import Constants from "expo-constants";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform } from "react-native";
import { useAccount } from "@/api/account";
import { useSendBugReport } from "@/api/bugReports";
import { Body, Button, Card, ErrorNote, Field, Muted, Screen } from "@/components/ui";

/**
 * "Report a bug" for dev and admin accounts (DESIGN.md §8.9), as a sheet. `?from=` names the
 * screen it was opened from; the app version and device go along.
 */
export default function BugReportScreen() {
  const { tester } = useAccount();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const send = useSendBugReport();
  const [message, setMessage] = useState("");

  if (!tester) {
    return (
      <Screen title="Not found">
        <Muted>This screen isn&apos;t available.</Muted>
      </Screen>
    );
  }
  if (send.isSuccess) {
    return (
      <Screen title="Thanks, got it">
        <Stack.Screen options={{ title: "Report a bug" }} />
        <Muted>It&apos;s in the queue for the team.</Muted>
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <Screen title="Report a bug">
      <Stack.Screen options={{ title: "Report a bug" }} />
      <Card style={{ gap: 12 }}>
        <Body>What happened, and what did you expect?</Body>
        <Field
          accessibilityLabel="What went wrong"
          value={message}
          onChangeText={setMessage}
          maxLength={MAX_BUG_REPORT}
          multiline
          autoFocus
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          placeholder="I tapped End my day and…"
          style={{ minHeight: 140 }}
        />
        <Muted style={{ fontSize: 13 }}>The app version and your device are sent along.</Muted>
        <ErrorNote error={send.error} />
        <Button
          title="Send report"
          busy={send.isPending}
          disabled={!message.trim() || send.isPending}
          onPress={() =>
            send.mutate({
              message,
              page: from ?? "",
              platform: "ios",
              appVersion: Constants.expoConfig?.version ?? null,
              device: `${Constants.deviceName ?? "iPhone"} · iOS ${Platform.Version}`,
            })
          }
        />
      </Card>
    </Screen>
  );
}
