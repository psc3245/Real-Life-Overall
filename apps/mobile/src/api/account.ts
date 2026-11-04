import {
  isPremiumRole,
  isTesterRole,
  type AiUsageDto,
  type Feature,
  type FeatureLock,
} from "@rlo/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { useMe } from "./hooks";
import { useAuthState } from "./session";

/** The signed-in account's type (DESIGN.md §8.9). Free until /me loads. */
export function useAccount() {
  const { signedIn } = useAuthState();
  const me = useMe(signedIn);
  const role = me.data?.role ?? "user";
  const locked: Partial<Record<Feature, FeatureLock>> = me.data?.locked ?? {};
  return { role, premium: isPremiumRole(role), tester: isTesterRole(role), locked };
}

/** Share of the rolling 24-hour AI budget used (DESIGN.md §8.9). */
export function useAiUsage() {
  return useQuery({ queryKey: ["me", "ai-usage"], queryFn: () => api<AiUsageDto>("/me/ai-usage") });
}
