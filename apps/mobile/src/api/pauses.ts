import type { PauseDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { changesKey, ratingsKey } from "./ratings";

export const pausesKey = ["pauses"] as const;

export function usePauses() {
  return useQuery({ queryKey: pausesKey, queryFn: () => api<PauseDto[]>("/pauses") });
}

/** Pauses change which days decay, so ratings and the change feed refresh too. */
function usePauseMutation<TInput>(request: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all(
        [pausesKey, ratingsKey, changesKey].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

export function useCreatePause() {
  return usePauseMutation((input: { startsOn: string; endsOn: string | null; reason: string }) =>
    api<PauseDto>("/pauses", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useEndPause() {
  return usePauseMutation(({ id, endsOn }: { id: string; endsOn: string }) =>
    api<PauseDto | null>(`/pauses/${id}/end`, { method: "POST", body: JSON.stringify({ endsOn }) }),
  );
}

/** Development only: run the 4am job (auto-recaps + decay) for the current user now. */
export function useRunScheduled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ recapped: string[]; failed: string[]; decayDays: number }>("/dev/run-scheduled", {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
