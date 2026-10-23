import { NativeTabs } from "expo-router/native-tabs";
import { useFriends } from "@/api/social";
import { colors } from "@/lib/theme";

export default function TabsLayout() {
  // Pending friend requests badge the You tab (the web shows them on Friends in the header).
  const requests = useFriends().data?.incoming.length ?? 0;
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
        {requests > 0 && <NativeTabs.Trigger.Badge>{String(requests)}</NativeTabs.Trigger.Badge>}
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
