import type {
  AnswerValue,
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

const post = (path: string, body?: unknown) => () =>
  api<OnboardingStateDto>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

export function useGenerateQuestionnaire() {
  return useStateMutation(() => post("/onboarding/questionnaire")());
}

export function useSaveAnswers() {
  return useStateMutation((answers: Record<string, AnswerValue | null>) =>
    api<OnboardingStateDto>("/onboarding/answers", {
      method: "PUT",
      body: JSON.stringify({ answers }),
    }),
  );
}

export function useSubmitQuestionnaire() {
  return useStateMutation(() => post("/onboarding/questionnaire/submit")());
}

/** No message opens the conversation; afterwards each call sends the user's reply. */
export function useFollowup() {
  return useStateMutation((message: string | undefined) =>
    post("/onboarding/followup", message === undefined ? undefined : { message })(),
  );
}

export function useFinishFollowup() {
  return useStateMutation(() => post("/onboarding/followup/finish")());
}

/** No message opens the discovery conversation; afterwards each call sends the user's reply. */
export function useDiscovery() {
  return useStateMutation((message: string | undefined) =>
    post("/onboarding/discovery", message === undefined ? undefined : { message })(),
  );
}

export function useSkipDiscovery() {
  return useStateMutation(() => post("/onboarding/discovery/skip")());
}

export function useDraftTemplate() {
  return useStateMutation(() => post("/onboarding/template")());
}
