import type { ProfileDto, ProfileVisibility } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys, type Me } from "./hooks";

export const profileKey = (username: string) => ["profile", username] as const;

export function useProfile(username: string) {
  return useQuery({
    queryKey: profileKey(username),
    queryFn: () => api<ProfileDto>(`/profiles/${encodeURIComponent(username)}`),
    retry: false,
  });
}

export interface ProfileSettings {
  displayName?: string;
  username?: string;
  profileVisibility?: ProfileVisibility;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileSettings) =>
      api<Me>("/me", { method: "PATCH", body: JSON.stringify(changes) }),
    onSuccess: async (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
