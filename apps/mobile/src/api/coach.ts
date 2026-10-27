import type { CoachStateDto, HabitDto, ObjectiveDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { habitsKey } from "./days";
import { scoutingReportKey } from "./evolution";
import { objectivesKey } from "./objectives";

export const coachKey = ["coach"] as const;

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
    onSuccess: (state) => queryClient.setQueryData(coachKey, state),
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
