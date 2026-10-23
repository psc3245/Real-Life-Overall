import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function HabitsLayout() {
  return <Stack screenOptions={tabStackOptions} />;
}
