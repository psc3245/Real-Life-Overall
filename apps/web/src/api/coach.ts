import type { CoachStateDto, HabitDto, ObjectiveDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { habitsKey } from "./days";
import { scoutingReportKey } from "./evolution";
import { objectivesKey } from "./objectives";
import { ratingsKey } from "./ratings";
import { exercisesKey, workoutsKey } from "./workouts";

export const coachKey = ["coach"] as const;

/** What the coach logs (or undoes) shows up on the day log, workouts and goals. */
function refreshLogged(queryClient: QueryClient) {
  return Promise.all(
    [["day"], workoutsKey, exercisesKey, objectivesKey, [...ratingsKey, "activity"]].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useCoach() {
  return useQuery({ queryKey: coachKey, queryFn: () => api<CoachStateDto>("/coach") });
}

export function useSendCoachMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<CoachStateDto>("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content }),
      }),
    onSuccess: async (state) => {
      queryClient.setQueryData(coachKey, state);
      if (state.messages.at(-1)?.actions.length) await refreshLogged(queryClient);
    },
  });
}

/** The postgame interview: the coach's opening questions about a day just recapped. */
export function useStartPostgame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api<CoachStateDto>("/coach/postgame", { method: "POST", body: JSON.stringify({ date }) }),
    onSuccess: (state) => queryClient.setQueryData(coachKey, state),
  });
}

export function useUndoCoachAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api<CoachStateDto>(`/coach/messages/${messageId}/actions/${index}/undo`, {
        method: "POST",
      }),
    onSuccess: async (state) => {
      queryClient.setQueryData(coachKey, state);
      await refreshLogged(queryClient);
    },
  });
}

export function useClearCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<CoachStateDto>("/coach", { method: "DELETE" }),
    onSuccess: (state) => queryClient.setQueryData(coachKey, state),
  });
}

export function useResolveCoachSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      index,
      action,
    }: {
      messageId: string;
      index: number;
      action: "accept" | "dismiss";
    }) =>
      api<{ state: CoachStateDto; habit: HabitDto | null; goal: ObjectiveDto | null }>(
        `/coach/messages/${messageId}/suggestions/${index}/${action}`,
        { method: "POST" },
      ),
    onSuccess: async ({ state }) => {
      queryClient.setQueryData(coachKey, state);
      await Promise.all(
        [habitsKey, objectivesKey, scoutingReportKey, ["day"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}
