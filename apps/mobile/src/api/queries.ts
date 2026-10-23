import type { DayDto, HabitEntryValue, MeDto, RatingsDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./client";

// Same keys as the web app (apps/web/src/api) so the two read alike.
export const meKey = ["me"] as const;
export const ratingsKey = ["ratings"] as const;
export const dayKey = (date: string | null) => ["day", date ?? "today"] as const;

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => api<MeDto>("/me") });
}

/** Resolves to null (not an error) when the player has no ratings yet. */
export function useRatings() {
  return useQuery({
    queryKey: ratingsKey,
    queryFn: async () => {
      try {
        return await api<RatingsDto>("/ratings");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
  });
}

/** `date` null loads the player's today (in their timezone). */
export function useDay(date: string | null) {
  return useQuery({
    queryKey: dayKey(date),
    queryFn: () => api<DayDto>(date ? `/days/${date}` : "/days/today"),
  });
}

export function useSaveEntry(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, value }: { habitId: string; value: HabitEntryValue }) =>
      api<DayDto>(`/days/${date}/habits/${habitId}`, {
        method: "PUT",
        body: JSON.stringify(value),
      }),
    onSuccess: (day) => {
      queryClient.setQueryData(dayKey(day.date), day);
      if (day.date === day.today) queryClient.setQueryData(dayKey(null), day);
    },
  });
}
