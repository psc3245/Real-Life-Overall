import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function TodayLayout() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Today", headerShown: false }} />
    </Stack>
  );
}
