import { isPremiumRole, isTesterRole, type FeatureLock, type Feature } from "@rlo/shared";
import { useAuthState } from "./auth";
import { useMe } from "./hooks";

/** The signed-in account's type (DESIGN.md §8.9). Free until /me loads. */
export function useAccount() {
  const auth = useAuthState();
  const me = useMe(auth.signedIn);
  const role = me.data?.role ?? "user";
  const locked: Partial<Record<Feature, FeatureLock>> = me.data?.locked ?? {};
  return { role, premium: isPremiumRole(role), tester: isTesterRole(role), locked };
}
