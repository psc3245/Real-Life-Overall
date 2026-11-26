import type { GamePlanDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { HapticKind } from "@/lib/haptics";
import { api } from "./client";

export const gamePlansKey = ["game-plans"] as const;

export function useGamePlans() {
  return useQuery({ queryKey: gamePlansKey, queryFn: () => api<GamePlanDto[]>("/game-plans") });
}

function useGamePlanMutation<TInput, TOutput>(
  request: (input: TInput) => Promise<TOutput>,
  haptic: HapticKind = "success",
) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { haptic },
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: gamePlansKey }),
  });
}

export interface GamePlanInput {
  name: string;
  note: string;
  startsOn: string;
  endsOn: string;
  links: string[];
}

export function useCreateGamePlan() {
  return useGamePlanMutation((input: GamePlanInput) =>
    api<GamePlanDto>("/game-plans", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateGamePlan() {
  return useGamePlanMutation(({ id, ...input }: Partial<GamePlanInput> & { id: string }) =>
    api<GamePlanDto>(`/game-plans/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export function useDeleteGamePlan() {
  return useGamePlanMutation(
    (id: string) => api<null>(`/game-plans/${id}`, { method: "DELETE" }),
    "remove",
  );
}
