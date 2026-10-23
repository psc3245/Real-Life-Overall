import type {
  DayDto,
  HabitDto,
  HabitEntryValue,
  HabitStatRange,
  HabitStatsResponseDto,
  HabitType,
  LinkSuggestionDto,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { changesKey, ratingsKey } from "./ratings";

export const dayKey = (date: string | null) => ["day", date ?? "today"] as const;
export const habitsKey = ["habits"] as const;

/** `date` null loads the user's today (in their timezone). */
export function useDay(date: string | null) {
  return useQuery({
    queryKey: dayKey(date),
    queryFn: () => api<DayDto>(date ? `/days/${date}` : "/days/today"),
  });
}

function useDayMutation<TInput>(request: (input: TInput) => Promise<DayDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (day) => {
      queryClient.setQueryData(dayKey(day.date), day);
      if (day.date === day.today) queryClient.setQueryData(dayKey(null), day);
      void queryClient.invalidateQueries({ queryKey: [...habitsKey, "stats"] });
    },
  });
}

export function useSaveJournal(date: string) {
  return useDayMutation((journal: string) =>
    api<DayDto>(`/days/${date}/journal`, { method: "PUT", body: JSON.stringify({ journal }) }),
  );
}

export function useSaveEntry(date: string, habitId: string) {
  return useDayMutation((value: HabitEntryValue) =>
    api<DayDto>(`/days/${date}/habits/${habitId}`, {
      method: "PUT",
      body: JSON.stringify(value),
    }),
  );
}

/** At-a-glance stats for the period of `range` containing `date` (default today). */
export function useHabitStats(range: HabitStatRange, date?: string) {
  return useQuery({
    queryKey: [...habitsKey, "stats", range, date ?? "today"],
    queryFn: () =>
      api<HabitStatsResponseDto>(`/habits/stats?range=${range}${date ? `&date=${date}` : ""}`),
  });
}

export function useHabits() {
  return useQuery({ queryKey: habitsKey, queryFn: () => api<HabitDto[]>("/habits") });
}

function useHabitMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: habitsKey }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
      ]),
  });
}

export interface HabitInput {
  name: string;
  type: HabitType;
  config: Partial<HabitDto["config"]>;
  days: number[];
  links: string[];
  startsOn: string;
}

export function useCreateHabit() {
  return useHabitMutation((input: HabitInput) =>
    api<HabitDto>("/habits", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateHabit() {
  return useHabitMutation(({ id, ...input }: Omit<HabitInput, "type"> & { id: string }) =>
    api<HabitDto>(`/habits/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export function useArchiveHabit() {
  return useHabitMutation((id: string) => api<null>(`/habits/${id}`, { method: "DELETE" }));
}

export function useSuggestLinks() {
  return useMutation({
    mutationFn: (input: { name: string; type: HabitType }) =>
      api<LinkSuggestionDto>("/habits/suggest-links", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useSavePromptAnswers(date: string) {
  return useDayMutation((answers: (string | null)[]) =>
    api<DayDto>(`/days/${date}/prompts`, { method: "PUT", body: JSON.stringify({ answers }) }),
  );
}

/** "End my day": runs (or re-runs) the recap, then refreshes everything ratings-related. */
export function useEndDay(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<DayDto>(`/days/${date}/recap`, { method: "POST" }),
    onSuccess: async (day) => {
      queryClient.setQueryData(dayKey(day.date), day);
      if (day.date === day.today) queryClient.setQueryData(dayKey(null), day);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ratingsKey }),
        queryClient.invalidateQueries({ queryKey: changesKey }),
        // The recap may have seeded tomorrow's questions.
        queryClient.invalidateQueries({ queryKey: ["day"] }),
      ]);
    },
  });
}
