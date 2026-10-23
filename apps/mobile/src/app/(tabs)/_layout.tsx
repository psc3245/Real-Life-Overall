import { NativeTabs } from "expo-router/native-tabs";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.neon}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="habits">
        <NativeTabs.Trigger.Label>Habits</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week">
        <NativeTabs.Trigger.Label>Week</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ratings">
        <NativeTabs.Trigger.Label>Ratings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
