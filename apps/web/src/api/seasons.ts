import type {
  RatingsDto,
  SeasonCardDto,
  SeasonDetailDto,
  SeasonSetupDto,
  TreeDraftNode,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ratingsKey } from "./ratings";

const seasonsKey = ["seasons"] as const;

export function useSeasonCards() {
  return useQuery({ queryKey: seasonsKey, queryFn: () => api<SeasonCardDto[]>("/seasons") });
}

export function useSeasonDetail(id: string) {
  return useQuery({
    queryKey: [...seasonsKey, "detail", id],
    queryFn: () => api<SeasonDetailDto>(`/seasons/${id}`),
    retry: false,
  });
}

export function useSeasonSetup() {
  return useQuery({
    queryKey: [...seasonsKey, "setup"],
    queryFn: () => api<SeasonSetupDto>("/seasons/setup"),
  });
}

export function useSaveSeasonTree() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nodes: TreeDraftNode[]) =>
      api<RatingsDto>("/seasons/setup/tree", { method: "PUT", body: JSON.stringify({ nodes }) }),
    onSuccess: async (ratings) => {
      queryClient.setQueryData(ratingsKey, ratings);
      await queryClient.invalidateQueries({ queryKey: ratingsKey });
      await queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}
