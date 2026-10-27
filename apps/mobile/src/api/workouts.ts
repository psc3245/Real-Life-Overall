import type {
  BodyDto,
  ExerciseCategory,
  ExerciseDetailDto,
  ExerciseDto,
  ExerciseTracking,
  WorkoutDto,
  WorkoutExerciseDto,
  WorkoutHistoryDto,
  WorkoutTemplateDto,
} from "@rlo/shared";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { api } from "./client";

export const workoutsKey = ["workouts"] as const;
export const activeWorkoutKey = ["workouts", "active"] as const;
export const templatesKey = ["workout-templates"] as const;
export const exercisesKey = ["exercises"] as const;
export const bodyKey = ["body"] as const;

/** Finished workouts change the day log, goals that count workouts and exercise stats. */
function refreshAfterWorkout(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: workoutsKey }),
    queryClient.invalidateQueries({ queryKey: exercisesKey }),
    queryClient.invalidateQueries({ queryKey: ["day"] }),
    queryClient.invalidateQueries({ queryKey: ["objectives"] }),
  ]);
}

export function useActiveWorkout() {
  return useQuery({
    queryKey: activeWorkoutKey,
    queryFn: () => api<WorkoutDto | null>("/workouts/active"),
  });
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: [...workoutsKey, "one", id],
    queryFn: () => api<WorkoutDto>(`/workouts/${id}`),
  });
}

export function useWorkoutHistory() {
  return useInfiniteQuery({
    queryKey: [...workoutsKey, "history"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api<WorkoutHistoryDto>(
        `/workouts${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ""}`,
      ),
    getNextPageParam: (last) => last.nextBefore,
  });
}

export function useStartWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { templateId?: string } = {}) =>
      api<WorkoutDto>("/workouts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (workout) => {
      queryClient.setQueryData(activeWorkoutKey, workout);
      await queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

export interface WorkoutChanges {
  name?: string;
  notes?: string;
  exercises?: WorkoutExerciseDto[];
  localDate?: string;
  durationS?: number;
}

/** Saves a workout. The caller owns the editing state; this only keeps the cache in step. */
export function useSaveWorkout(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: WorkoutChanges) =>
      api<WorkoutDto>(`/workouts/${id}`, { method: "PUT", body: JSON.stringify(changes) }),
    onSuccess: async (workout) => {
      if (!workout.endedAt) queryClient.setQueryData(activeWorkoutKey, workout);
      else {
        queryClient.setQueryData([...workoutsKey, "one", id], workout);
        await refreshAfterWorkout(queryClient);
      }
    },
  });
}

export function useFinishWorkout(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options: { updateTemplate: boolean }) =>
      api<WorkoutDto>(`/workouts/${id}/finish`, {
        method: "POST",
        body: JSON.stringify(options),
      }),
    onSuccess: (workout) => {
      queryClient.setQueryData([...workoutsKey, "one", id], workout);
      // Not awaited: the caller navigates to the summary first, so the live page (which
      // redirects once nothing is in progress) is already gone when the active query empties.
      void refreshAfterWorkout(queryClient);
      void queryClient.invalidateQueries({ queryKey: templatesKey });
    },
  });
}

/** Cancels a workout in progress or deletes a finished one. */
export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<null>(`/workouts/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      queryClient.setQueryData(activeWorkoutKey, null);
      await refreshAfterWorkout(queryClient);
    },
  });
}

// Templates

export function useTemplates() {
  return useQuery({
    queryKey: templatesKey,
    queryFn: () => api<WorkoutTemplateDto[]>("/workout-templates"),
  });
}

export interface TemplateInput {
  name: string;
  notes: string;
  exercises: WorkoutExerciseDto[];
}

function useTemplateMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  });
}

export function useCreateTemplate() {
  return useTemplateMutation((input: TemplateInput | { fromWorkoutId: string; name?: string }) =>
    api<WorkoutTemplateDto>("/workout-templates", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export function useUpdateTemplate() {
  return useTemplateMutation(({ id, ...input }: Partial<TemplateInput> & { id: string }) =>
    api<WorkoutTemplateDto>(`/workout-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export function useDeleteTemplate() {
  return useTemplateMutation((id: string) =>
    api<null>(`/workout-templates/${id}`, { method: "DELETE" }),
  );
}

// Exercises

export function useExercises() {
  return useQuery({ queryKey: exercisesKey, queryFn: () => api<ExerciseDto[]>("/exercises") });
}

export function useExercise(id: string) {
  return useQuery({
    queryKey: [...exercisesKey, id],
    queryFn: () => api<ExerciseDetailDto>(`/exercises/${id}`),
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; category: ExerciseCategory; tracking: ExerciseTracking }) =>
      api<ExerciseDto>("/exercises", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesKey }),
  });
}

export function useArchiveExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<null>(`/exercises/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exercisesKey }),
  });
}

// Body

export function useBody() {
  return useQuery({ queryKey: bodyKey, queryFn: () => api<BodyDto>("/body") });
}

export function useSaveBody() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      ...values
    }: {
      date: string;
      weightKg?: number | null;
      heightCm?: number | null;
    }) => api<BodyDto>(`/body/${date}`, { method: "PUT", body: JSON.stringify(values) }),
    onSuccess: async (body) => {
      queryClient.setQueryData(bodyKey, body);
      await queryClient.invalidateQueries({ queryKey: ["day"] });
    },
  });
}
