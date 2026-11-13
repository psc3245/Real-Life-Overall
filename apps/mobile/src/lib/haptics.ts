import * as Haptics from "expo-haptics";

// Haptics never matter enough to surface a failure (some devices have no engine).
const quietly = (p: Promise<void>) => void p.catch(() => {});

/**
 * Feedback for actions that matter (DESIGN.md §10): not every tap, just the moments a player
 * would want to feel land. Named by meaning so each screen picks the same feel for the same thing.
 */
export const haptics = {
  /** A light tick: steppers, picks, undoing a check. */
  tap: () => quietly(Haptics.selectionAsync()),
  /** Something added or checked off: a set, an exercise, a habit. */
  impact: () => quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Something removed or deleted. */
  remove: () => quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** A big action finished, or something the player waited on came back: done. */
  success: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Time's up (rest over), or a waited-on action needs a look. */
  warning: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A waited-on action failed. */
  error: () => quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export type HapticKind = Exclude<keyof typeof haptics, "error">;

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Felt when the request lands; a failure is always felt as an error. */
      haptic?: HapticKind;
    };
  }
}

/** For the query client's MutationCache: haptics declared on a mutation fire when it settles. */
export const mutationHaptics = {
  onSuccess: (
    _data: unknown,
    _vars: unknown,
    _ctx: unknown,
    m: { meta?: { haptic?: HapticKind } },
  ) => {
    const kind = m.meta?.haptic;
    if (kind) haptics[kind]();
  },
  onError: (
    _error: unknown,
    _vars: unknown,
    _ctx: unknown,
    m: { meta?: { haptic?: HapticKind } },
  ) => {
    if (m.meta?.haptic) haptics.error();
  },
};
