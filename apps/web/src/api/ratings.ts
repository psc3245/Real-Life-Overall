import type { ChangeFeedItemDto, OnboardingStateDto, RatingsDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import { onboardingKey } from "./onboarding";

export const ratingsKey = ["ratings"] as const;
export const changesKey = ["rating-changes"] as const;

/** Resolves to null (not an error) when the user has no ratings yet. */
export function useRatings(enabled = true) {
  return useQuery({
    enabled,
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

export function useRateInitial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<OnboardingStateDto>("/onboarding/rate", { method: "POST" }),
    onSuccess: async (state) => {
      queryClient.setQueryData(onboardingKey, state);
      await queryClient.invalidateQueries({ queryKey: ratingsKey });
    },
  });
}

export function useChanges(limit = 30) {
  return useQuery({
    queryKey: [...changesKey, limit],
    queryFn: () => api<ChangeFeedItemDto[]>(`/ratings/changes?limit=${limit}`),
  });
}
