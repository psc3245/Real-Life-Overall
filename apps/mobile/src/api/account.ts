import { isPremiumRole, isTesterRole, type Feature, type FeatureLock } from "@rlo/shared";
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
