import type { DayDto, ObjectiveDto, ObjectiveSource } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { dayKey } from "./days";

export const objectivesKey = ["objectives"] as const;

export function useObjectives() {
  return useQuery({ queryKey: objectivesKey, queryFn: () => api<ObjectiveDto[]>("/objectives") });
}

function useObjectiveMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: objectivesKey }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
      ]),
  });
}

export interface ObjectiveInput {
  name: string;
  target: number;
  unit: string;
  startsOn: string;
  endsOn: string;
  links: string[];
  source: ObjectiveSource;
  habitId?: string;
}

export function useCreateObjective() {
  return useObjectiveMutation((input: ObjectiveInput) =>
    api<ObjectiveDto>("/objectives", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateObjective() {
  return useObjectiveMutation(
    ({ id, ...input }: Partial<Omit<ObjectiveInput, "source" | "habitId">> & { id: string }) =>
      api<ObjectiveDto>(`/objectives/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export function useDeleteObjective() {
  return useObjectiveMutation((id: string) => api<null>(`/objectives/${id}`, { method: "DELETE" }));
}

/** Sets what a manual goal gained on `date`; null clears it. */
export function useSaveObjectiveEntry(date: string, objectiveId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: number | null) =>
      api<DayDto>(`/days/${date}/objectives/${objectiveId}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    onSuccess: (day) => {
      queryClient.setQueryData(dayKey(day.date), day);
      if (day.date === day.today) queryClient.setQueryData(dayKey(null), day);
      void queryClient.invalidateQueries({ queryKey: objectivesKey });
    },
  });
}
