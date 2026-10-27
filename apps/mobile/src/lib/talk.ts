import { TALK, type TalkTerms } from "@rlo/shared";
import { usePreferences } from "@/api/preferences";

/** The app's words for the player's sports-talk setting (DESIGN.md §7.10). */
export function useTalk(): TalkTerms {
  return TALK[usePreferences().sportsTalk];
}

/** "the scout" → "The scout", for the start of a sentence. */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
