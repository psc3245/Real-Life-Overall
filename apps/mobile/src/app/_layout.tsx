import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useMe } from "@/api/hooks";
import { OwnScoreProvider } from "@/components/score";
import { TimezoneSync } from "@/components/TimezoneSync";
import { AppState } from "react-native";
import { useAuthState } from "@/api/session";
import { Button, Card, Muted, Screen, Body } from "@/components/ui";
import { API_URL } from "@/lib/config";
import { pushedOptions } from "@/lib/stack";
import { colors, setTierPalette } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

// Refetch stale queries when the app comes back to the foreground.
AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.neon,
    background: colors.court950,
    card: colors.court900,
    text: colors.court100,
    border: colors.court700,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <RootStack />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const auth = useAuthState();
  useEffect(() => {
    if (!auth.loading) void SplashScreen.hideAsync();
  }, [auth.loading]);

  if (auth.loading) return null;
  if ("error" in auth && auth.error) return <Unreachable />;

  return (
    <OwnScoreProvider enabled={auth.signedIn}>
      {auth.signedIn && <SignedInSync />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={auth.signedIn}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log" options={pushedOptions} />
          <Stack.Screen name="node/[id]" options={pushedOptions} />
          <Stack.Screen name="habits/manage" options={pushedOptions} />
          <Stack.Screen name="habits/edit" options={{ ...pushedOptions, presentation: "modal" }} />
          <Stack.Screen name="onboarding" options={pushedOptions} />
          <Stack.Screen name="activity" options={pushedOptions} />
          <Stack.Screen name="history/index" options={pushedOptions} />
          <Stack.Screen name="history/[id]" options={pushedOptions} />
          <Stack.Screen name="season-setup" options={pushedOptions} />
          <Stack.Screen name="u/[username]" options={pushedOptions} />
          <Stack.Screen name="friends" options={pushedOptions} />
          <Stack.Screen name="leaderboards" options={pushedOptions} />
          <Stack.Screen name="compare/[username]" options={pushedOptions} />
          <Stack.Screen name="goals/edit" options={{ ...pushedOptions, presentation: "modal" }} />
          <Stack.Screen
            name="workouts/active"
            options={{ ...pushedOptions, gestureEnabled: false }}
          />
          <Stack.Screen name="workouts/[id]" options={pushedOptions} />
          <Stack.Screen name="workouts/history" options={pushedOptions} />
          <Stack.Screen
            name="workouts/template"
            options={{ ...pushedOptions, presentation: "modal" }}
          />
          <Stack.Screen name="workouts/exercises/index" options={pushedOptions} />
          <Stack.Screen name="workouts/exercises/[id]" options={pushedOptions} />
          <Stack.Screen name="body" options={pushedOptions} />
          <Stack.Screen name="charts" options={pushedOptions} />
          <Stack.Screen name="reports/index" options={pushedOptions} />
          <Stack.Screen name="reports/[id]" options={pushedOptions} />
          <Stack.Screen name="reports/edit" options={{ ...pushedOptions, presentation: "modal" }} />
          <Stack.Screen name="coach" options={pushedOptions} />
          <Stack.Screen name="scouting-report" options={pushedOptions} />
          <Stack.Screen name="settings" options={pushedOptions} />
          <Stack.Screen name="personalize" options={pushedOptions} />
          <Stack.Screen name="admin" options={pushedOptions} />
        </Stack.Protected>
        <Stack.Protected guard={!auth.signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </OwnScoreProvider>
  );
}

/**
 * Keeps the app in step with the account: the timezone, and the tier palette (a synced
 * preference that colors ratings everywhere). Screens re-render on /me changes, so setting the
 * palette during render reaches them.
 */
function SignedInSync() {
  const palette = useMe().data?.preferences.tierPalette;
  if (palette) setTierPalette(palette);
  return <TimezoneSync />;
}

function Unreachable() {
  return (
    <Screen>
      <Card style={{ gap: 12, marginTop: 80 }}>
        <Body>Can&apos;t reach the API.</Body>
        <Muted>Tried {API_URL}. Start it with `npm run dev:api`, or set EXPO_PUBLIC_API_URL.</Muted>
        <Button title="Try again" onPress={() => void queryClient.refetchQueries()} />
      </Card>
    </Screen>
  );
}
