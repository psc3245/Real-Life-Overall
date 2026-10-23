import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function TodayLayout() {
  return <Stack screenOptions={tabStackOptions} />;
}
