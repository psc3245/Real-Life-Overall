import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function WeekLayout() {
  return <Stack screenOptions={tabStackOptions} />;
}
