import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function SettingsLayout() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Settings" }} />
    </Stack>
  );
}
