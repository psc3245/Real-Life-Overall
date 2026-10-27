import type { ProfileVisibility } from "@rlo/shared";

/** Who can open a player's card, as the sharing settings and profile page word it. */
export const VISIBILITY_INFO: Record<ProfileVisibility, { label: string; detail: string }> = {
  private: { label: "Only me", detail: "Nobody else can open your profile." },
  friends: {
    label: "Friends",
    detail: "Players you've accepted as friends can see your card.",
  },
  public: {
    label: "Anyone with the link",
    detail: "Anyone with your link can see your card, signed in or not.",
  },
};
