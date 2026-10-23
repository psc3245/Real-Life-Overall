import { statPeriod, WEEKDAY_NAMES, type RatedNodeDto, type WeekRange } from "@rlo/shared";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useDay } from "@/api/days";
import { useMe } from "@/api/hooks";
import { useRatings } from "@/api/ratings";
import { useRunWeekly, useSetWeekStart, useWeekly } from "@/api/weekly";
import { FormRow, Segmented } from "@/components/controls";
import { EarlierWeek, ReviewCard } from "@/components/ReviewCard";
import {
  Button,
  Card,
  ErrorNote,
  Label,
  Loading,
  Muted,
  NeedsRating,
  Screen,
} from "@/components/ui";
import { WeekBreakdown } from "@/components/WeekBreakdown";
import { shortDate } from "@/lib/format";
import { space } from "@/lib/theme";

const WORKING = ["Reading your week…", "Checking habits and decay…", "Setting next week's focus…"];

export default function WeekScreen() {
  const weekly = useWeekly();
  const ratings = useRatings();
  const run = useRunWeekly();
  const [line, setLine] = useState(0);
  useEffect(() => {
    if (!run.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % WORKING.length), 4000);
    return () => clearInterval(timer);
  }, [run.isPending]);
  const refresh = () => void Promise.all([weekly.refetch(), ratings.refetch()]);

  if (ratings.data === null) return <NeedsRating />;
  if (weekly.isPending || ratings.isPending) return <Loading title="Week" />;
  if (weekly.isError) {
    return (
      <Screen title="Week" onRefresh={refresh}>
        <ErrorNote error={weekly.error} onRetry={refresh} />
      </Screen>
    );
  }
  const { week, review, ready, history } = weekly.data;
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));

  return (
    <Screen
      eyebrow="Weekly review"
      title={week ? `${shortDate(week.start)} – ${shortDate(week.end)}` : "Your week"}
      onRefresh={refresh}
      refreshing={weekly.isRefetching}
    >
      <WeekStartPicker />

      {!week && (
        <Card>
          <Muted>
            Your first weekly review arrives after your first full week. It runs automatically early
            the next morning, or you can run it here.
          </Muted>
        </Card>
      )}

      {ready && (
        <Card style={{ gap: space.md }}>
          <Muted>
            This week is done. The scout reviews it as a whole: what worked, what slipped, your
            focus for next week, and any habits worth adding.
          </Muted>
          <Button
            title={run.isPending ? WORKING[line]! : "Run weekly review"}
            disabled={run.isPending}
            onPress={() => run.mutate()}
          />
          {run.isPending && <Muted>Up to a minute.</Muted>}
          <ErrorNote error={run.error} />
        </Card>
      )}

      {review && <ReviewCard review={review} names={names} />}

      <WeekDetail lastWeek={week} nodes={ratings.data?.nodes ?? []} />

      {history.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Label>Earlier weeks</Label>
          {history.map((h) => (
            <EarlierWeek key={h.id} week={h} names={names} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Day-by-day specifics for the week in progress or the last finished one. */
function WeekDetail({ lastWeek, nodes }: { lastWeek: WeekRange | null; nodes: RatedNodeDto[] }) {
  const me = useMe();
  const today = useDay(null).data?.today;
  const [which, setWhich] = useState<"current" | "last">(lastWeek ? "last" : "current");
  if (!today || !me.data) return null;
  const current = statPeriod("week", today, me.data.weekStart);
  const week = which === "last" && lastWeek ? lastWeek : current;
  return (
    <View style={{ gap: space.md }}>
      <Label>Week in detail</Label>
      <Segmented
        label="Which week"
        options={[
          { value: "current", label: "This week" },
          ...(lastWeek ? [{ value: "last" as const, label: "Last week" }] : []),
        ]}
        value={which}
        onChange={setWhich}
      />
      <Muted>
        {shortDate(week.start)} – {shortDate(week.end)}
        {week === current && " · so far"}
      </Muted>
      <WeekBreakdown week={week} today={today} nodes={nodes} />
    </View>
  );
}

function WeekStartPicker() {
  const me = useMe();
  const set = useSetWeekStart();
  if (!me.data) return null;
  return (
    <FormRow label="Weeks start on">
      <Segmented
        label="Weeks start on"
        options={[1, 0, 6].map((d) => ({ value: String(d), label: WEEKDAY_NAMES[d]!.slice(0, 3) }))}
        value={String(me.data.weekStart)}
        onChange={(v) => !set.isPending && set.mutate(Number(v))}
      />
    </FormRow>
  );
}
