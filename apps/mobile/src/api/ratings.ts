import type {
  ActivityDayDto,
  ChangeFeedItemDto,
  HistoryDto,
  OnboardingStateDto,
  RatingsDto,
} from "@rlo/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export type ChangeSource = ChangeFeedItemDto["source"];

/** The change feed in pages (50 by default), optionally narrowed to sources or one node. */
export function useChangeFeed({
  sources,
  nodeId,
  pageSize = 50,
}: { sources?: ChangeSource[]; nodeId?: string; pageSize?: number } = {}) {
  return useInfiniteQuery({
    queryKey: [...changesKey, "feed", sources?.join(",") ?? "all", nodeId ?? "all", pageSize],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(pageSize), offset: String(pageParam) });
      if (sources?.length) params.set("source", sources.join(","));
      if (nodeId) params.set("nodeId", nodeId);
      return api<ChangeFeedItemDto[]>(`/ratings/changes?${params}`);
    },
    getNextPageParam: (last, pages) =>
      last.length === pageSize ? pages.length * pageSize : undefined,
  });
}

export function useHistory(days = 90) {
  return useQuery({
    queryKey: [...ratingsKey, "history", days],
    queryFn: () => api<HistoryDto>(`/ratings/history?days=${days}`),
  });
}

export function useActivity(days = 119) {
  return useQuery({
    queryKey: [...ratingsKey, "activity", days],
    queryFn: () => api<ActivityDayDto[]>(`/ratings/activity?days=${days}`),
  });
}

export function useSetGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, target }: { nodeId: string; target: number | null }) =>
      target === null
        ? api<null>(`/goals/${nodeId}`, { method: "DELETE" })
        : api<null>(`/goals/${nodeId}`, { method: "PUT", body: JSON.stringify({ target }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ratingsKey }),
  });
}
