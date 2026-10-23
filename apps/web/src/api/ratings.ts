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

export function useChanges(limit = 30) {
  return useQuery({
    queryKey: [...changesKey, limit],
    queryFn: () => api<ChangeFeedItemDto[]>(`/ratings/changes?limit=${limit}`),
  });
}

export type ChangeSource = ChangeFeedItemDto["source"];
const FEED_PAGE = 50;

/** The change feed in pages of 50, optionally narrowed to sources or one node (and below it). */
export function useChangeFeed({
  sources,
  nodeId,
}: { sources?: ChangeSource[]; nodeId?: string } = {}) {
  return useInfiniteQuery({
    queryKey: [...changesKey, "feed", sources?.join(",") ?? "all", nodeId ?? "all"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(FEED_PAGE), offset: String(pageParam) });
      if (sources?.length) params.set("source", sources.join(","));
      if (nodeId) params.set("nodeId", nodeId);
      return api<ChangeFeedItemDto[]>(`/ratings/changes?${params}`);
    },
    getNextPageParam: (last, pages) =>
      last.length === FEED_PAGE ? pages.length * FEED_PAGE : undefined,
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
