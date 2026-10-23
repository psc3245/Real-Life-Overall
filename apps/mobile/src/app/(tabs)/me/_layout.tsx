import { Stack } from "expo-router";
import { TabRootContext } from "@/components/ui";
import { tabStackOptions } from "@/lib/stack";

export default function MeLayout() {
  return (
    <TabRootContext.Provider value>
      <Stack screenOptions={tabStackOptions} />
    </TabRootContext.Provider>
  );
}
