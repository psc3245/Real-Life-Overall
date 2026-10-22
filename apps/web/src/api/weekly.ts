import type { FocusGoalDto, HabitDto, WeeklyStateDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { habitsKey } from "./days";
import { changesKey, ratingsKey } from "./ratings";

export const weeklyKey = ["weekly"] as const;
export const focusKey = ["weekly-focus"] as const;

export function useWeekly() {
  return useQuery({ queryKey: weeklyKey, queryFn: () => api<WeeklyStateDto>("/weekly") });
}

export function useFocus() {
  return useQuery({ queryKey: focusKey, queryFn: () => api<FocusGoalDto[]>("/weekly/focus") });
}

export function useRunWeekly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<WeeklyStateDto>("/weekly/run", { method: "POST" }),
    onSuccess: async (state) => {
      queryClient.setQueryData(weeklyKey, state);
      await Promise.all(
        [focusKey, ratingsKey, changesKey].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export function useResolveProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      index,
      action,
    }: {
      id: string;
      index: number;
      action: "accept" | "dismiss";
    }) =>
      api<{ state: WeeklyStateDto; habit: HabitDto | null }>(
        `/weekly/${id}/proposals/${index}/${action}`,
        { method: "POST" },
      ),
    onSuccess: async ({ state }) => {
      queryClient.setQueryData(weeklyKey, state);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
      ]);
    },
  });
}

export function useSetWeekStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weekStart: number) =>
      api("/me", { method: "PATCH", body: JSON.stringify({ weekStart }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
