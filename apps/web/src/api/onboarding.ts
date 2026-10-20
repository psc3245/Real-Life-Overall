import type {
  AttributeSuggestionDto,
  OnboardingStateDto,
  TreeDraftNode,
  WeightSuggestionDto,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const onboardingKey = ["onboarding"] as const;

export function useOnboarding() {
  return useQuery({
    queryKey: onboardingKey,
    queryFn: () => api<OnboardingStateDto>("/onboarding"),
  });
}

function useStateMutation<TInput>(request: (input: TInput) => Promise<OnboardingStateDto>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (state) => queryClient.setQueryData(onboardingKey, state),
  });
}

export function useSaveTree() {
  return useStateMutation((nodes: TreeDraftNode[]) =>
    api<OnboardingStateDto>("/onboarding/tree", {
      method: "PUT",
      body: JSON.stringify({ nodes }),
    }),
  );
}

export function useSaveWeights() {
  return useStateMutation((weights: { nodeId: string; weight: number }[]) =>
    api<OnboardingStateDto>("/onboarding/weights", {
      method: "PUT",
      body: JSON.stringify({ weights }),
    }),
  );
}

export function useSuggestWeights() {
  return useMutation({
    mutationFn: (priorities: string) =>
      api<WeightSuggestionDto>("/onboarding/weights/suggest", {
        method: "POST",
        body: JSON.stringify({ priorities }),
      }),
  });
}

export function useSuggestAttributes() {
  return useMutation({
    mutationFn: (input: { name: string; description: string; existing: string[] }) =>
      api<AttributeSuggestionDto[]>("/onboarding/attributes/suggest", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
