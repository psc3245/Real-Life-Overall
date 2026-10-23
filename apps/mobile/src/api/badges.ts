import type { BadgesDto } from "@rlo/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";
import { ratingsKey } from "./ratings";

/** Keyed under ratings so recaps and reviews (which invalidate ratings) refresh it too. */
export function useBadges() {
  return useQuery({
    queryKey: [...ratingsKey, "badges"],
    queryFn: () => api<BadgesDto>("/badges"),
  });
}
