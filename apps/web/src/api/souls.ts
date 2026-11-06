import type { LevelUpBody, SoulsDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ratingsKey } from "./ratings";

export const soulsKey = ["souls"] as const;

/** The bonfire (DESIGN.md §4.7); only Souls seasons have one. */
export function useSouls(enabled = true) {
  return useQuery({ enabled, queryKey: soulsKey, queryFn: () => api<SoulsDto>("/souls") });
}

export function useLevelUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LevelUpBody) =>
      api<SoulsDto>("/souls/level-up", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: async (souls) => {
      queryClient.setQueryData(soulsKey, souls);
      await queryClient.invalidateQueries({ queryKey: ratingsKey });
    },
  });
}
