import {
  isPremiumRole,
  isTesterRole,
  type AiUsageDto,
  type FeatureLock,
  type Feature,
  type SelfServeRole,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useAuthState } from "./auth";
import { queryKeys, useMe, type Me } from "./hooks";

/** The signed-in account's type (DESIGN.md §8.9). Free until /me loads. */
export function useAccount() {
  const auth = useAuthState();
  const me = useMe(auth.signedIn);
  const role = me.data?.role ?? "user";
  const locked: Partial<Record<Feature, FeatureLock>> = me.data?.locked ?? {};
  return { role, premium: isPremiumRole(role), tester: isTesterRole(role), locked };
}

/** Share of the rolling 24-hour AI budget used (DESIGN.md §8.9). */
export function useAiUsage() {
  return useQuery({ queryKey: ["me", "ai-usage"], queryFn: () => api<AiUsageDto>("/me/ai-usage") });
}

/**
 * Switches the account between Free, Premium and Dev from the upgrade page (DESIGN.md §8.9).
 * Everything refetches after, since what's locked changes across the app.
 */
export function useSetOwnRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (role: SelfServeRole) =>
      api<Me>("/me/role", { method: "PUT", body: JSON.stringify({ role }) }),
    onSuccess: async (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      await queryClient.invalidateQueries();
    },
  });
}
