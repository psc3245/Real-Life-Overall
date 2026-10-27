import { NativeTabs } from "expo-router/native-tabs";
import { usePreferences } from "@/api/preferences";
import { useFriends } from "@/api/social";
import { useTalk } from "@/lib/talk";
import { colors } from "@/lib/theme";

/**
 * Today, Playbook (habits, goals and training), Week, Rating and You. Tabs whose features are all
 * switched off in Personalize drop out, as their links do on the web.
 */
export default function TabsLayout() {
  const talk = useTalk();
  const { features } = usePreferences();
  // Pending friend requests badge the You tab (the web shows them on its League menu).
  const requests = useFriends(features.friends).data?.incoming.length ?? 0;
  const playbook = features.habits || features.goals || features.workouts;
  return (
    <NativeTabs tintColor={colors.neon}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Label>{talk.nav.today}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sun.max", selected: "sun.max.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="habits" hidden={!playbook}>
        <NativeTabs.Trigger.Label>{talk.nav.plan}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="checklist" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="week" hidden={!features.week}>
        <NativeTabs.Trigger.Label>{talk.nav.week}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ratings">
        <NativeTabs.Trigger.Label>Rating</NativeTabs.Trigger.Label>
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
