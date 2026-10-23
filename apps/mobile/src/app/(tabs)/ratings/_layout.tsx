import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function RatingsLayout() {
  return (
    <Stack screenOptions={tabStackOptions}>
      <Stack.Screen name="index" options={{ title: "Ratings", headerShown: false }} />
    </Stack>
  );
}
