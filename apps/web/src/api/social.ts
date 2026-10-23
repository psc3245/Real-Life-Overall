import type { FriendsDto, FriendshipState, ProfileDto, ProfileVisibility } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { queryKeys, type Me } from "./hooks";

export const profileKey = (username: string) => ["profile", username] as const;

export function useProfile(username: string, enabled = true) {
  return useQuery({
    enabled,
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

export const friendsKey = ["friends"] as const;

export function useFriends(enabled = true) {
  return useQuery({ queryKey: friendsKey, queryFn: () => api<FriendsDto>("/friends"), enabled });
}

/** Sends a request, accepts theirs (`add`), or cancels, declines or unfriends (`remove`). */
export function useFriendAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ username, action }: { username: string; action: "add" | "remove" }) =>
      api<{ state: FriendshipState }>(`/friends/${encodeURIComponent(username)}`, {
        method: action === "add" ? "POST" : "DELETE",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: friendsKey }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
      ]);
    },
  });
}
