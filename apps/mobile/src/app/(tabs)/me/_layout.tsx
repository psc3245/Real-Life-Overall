import { Stack } from "expo-router";
import { tabStackOptions } from "@/lib/stack";

export default function MeLayout() {
  return <Stack screenOptions={tabStackOptions} />;
}
