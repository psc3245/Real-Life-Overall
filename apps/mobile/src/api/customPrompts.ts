import type { CustomPromptDto } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { HapticKind } from "@/lib/haptics";

export const customPromptsKey = ["custom-prompts"] as const;

export function useCustomPrompts() {
  return useQuery({
    queryKey: customPromptsKey,
    queryFn: () => api<CustomPromptDto[]>("/custom-prompts"),
  });
}

/** Any change can add or drop a question on today's log. */
function usePromptMutation<TInput>(
  request: (input: TInput) => Promise<unknown>,
  haptic: HapticKind = "success",
) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: { haptic },
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: customPromptsKey }),
        queryClient.invalidateQueries({ queryKey: ["day"] }),
      ]),
  });
}

export interface CustomPromptInput {
  question: string;
  days: number[];
}

export function useCreateCustomPrompt() {
  return usePromptMutation((input: CustomPromptInput) =>
    api<CustomPromptDto>("/custom-prompts", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateCustomPrompt() {
  return usePromptMutation(({ id, ...input }: CustomPromptInput & { id: string }) =>
    api<CustomPromptDto>(`/custom-prompts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  );
}

export function useDeleteCustomPrompt() {
  return usePromptMutation(
    (id: string) => api<null>(`/custom-prompts/${id}`, { method: "DELETE" }),
    "remove",
  );
}
