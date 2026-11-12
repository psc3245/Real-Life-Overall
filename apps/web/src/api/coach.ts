import type { CoachStateDto, CoachThreadDto, HabitDto, ObjectiveDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { habitsKey } from "./days";
import { scoutingReportKey } from "./evolution";
import { objectivesKey } from "./objectives";
import { ratingsKey } from "./ratings";
import { exercisesKey, workoutsKey } from "./workouts";

export const coachKey = ["coach"] as const;
export const coachThreadsKey = ["coach", "threads"] as const;
/** A thread by id, "new" for an empty new chat, or "latest". */
export type ThreadRef = string;
const threadKey = (ref: ThreadRef) => ["coach", "thread", ref] as const;

/** A thread's state is cached under its id, and the threads list picks up its new time. */
function storeThread(queryClient: QueryClient, state: CoachStateDto) {
  if (state.thread) queryClient.setQueryData(threadKey(state.thread.id), state);
  return queryClient.invalidateQueries({ queryKey: coachThreadsKey });
}

/** What the coach logs (or undoes) shows up on the day log, workouts and goals. */
function refreshLogged(queryClient: QueryClient) {
  return Promise.all(
    [["day"], workoutsKey, exercisesKey, objectivesKey, [...ratingsKey, "activity"]].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export function useCoach(ref: ThreadRef = "latest") {
  return useQuery({
    queryKey: threadKey(ref),
    queryFn: () => api<CoachStateDto>(ref === "latest" ? "/coach" : `/coach?thread=${ref}`),
  });
}

export function useCoachThreads() {
  return useQuery({
    queryKey: coachThreadsKey,
    queryFn: () => api<CoachThreadDto[]>("/coach/threads"),
  });
}

/** Sends in a thread; `threadId` null starts a new one (the reply carries its id). */
export function useSendCoachMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, threadId }: { content: string; threadId: string | null }) =>
      api<CoachStateDto>("/coach/messages", {
        method: "POST",
        body: JSON.stringify({ content, threadId }),
      }),
    onSuccess: async (state) => {
      await storeThread(queryClient, state);
      if (state.messages.at(-1)?.actions.length) await refreshLogged(queryClient);
    },
  });
}

export function useDeleteCoachThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/coach/threads/${id}`, { method: "DELETE" }),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: threadKey(id) });
      queryClient.removeQueries({ queryKey: threadKey("latest") });
      return queryClient.invalidateQueries({ queryKey: coachThreadsKey });
    },
  });
}

/** The postgame interview: the coach's opening questions about a day just recapped. */
export function useStartPostgame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api<CoachStateDto>("/coach/postgame", { method: "POST", body: JSON.stringify({ date }) }),
    onSuccess: (state) => storeThread(queryClient, state),
  });
}

export function useUndoCoachAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, index }: { messageId: string; index: number }) =>
      api<CoachStateDto>(`/coach/messages/${messageId}/actions/${index}/undo`, {
        method: "POST",
      }),
    onSuccess: async (state) => {
      await storeThread(queryClient, state);
      await refreshLogged(queryClient);
    },
  });
}

/** Deletes every thread. */
export function useClearCoach() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<CoachStateDto>("/coach", { method: "DELETE" }),
    onSuccess: () => queryClient.removeQueries({ queryKey: coachKey }),
  });
}

export function useResolveCoachSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      messageId,
      index,
      action,
    }: {
      messageId: string;
      index: number;
      action: "accept" | "dismiss";
    }) =>
      api<{ state: CoachStateDto; habit: HabitDto | null; goal: ObjectiveDto | null }>(
        `/coach/messages/${messageId}/suggestions/${index}/${action}`,
        { method: "POST" },
      ),
    onSuccess: async ({ state }) => {
      await storeThread(queryClient, state);
      await Promise.all(
        [habitsKey, objectivesKey, scoutingReportKey, ["day"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}
