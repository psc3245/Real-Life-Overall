import type {
  FriendsDto,
  FriendshipState,
  LeaderboardDto,
  LeaderboardScope,
  ProfileDto,
  ProfileVisibility,
  SeasonMode,
  UnitSystem,
} from "@rlo/shared";
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
  leaderboardOptIn?: boolean;
  unitSystem?: UnitSystem;
  trackWeight?: boolean;
  trackHeight?: boolean;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileSettings) =>
      api<Me>("/me", { method: "PATCH", body: JSON.stringify(changes) }),
    onSuccess: async (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        // Units and body tracking change the day log and the body page.
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["body"] }),
      ]);
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
        queryClient.invalidateQueries({ queryKey: ["leaderboard"] }),
        // Units and body tracking change the day log and the body page.
        queryClient.invalidateQueries({ queryKey: ["day"] }),
        queryClient.invalidateQueries({ queryKey: ["body"] }),
      ]);
    },
  });
}

/** Without a mode, the server picks your own season's mode. */
export function useLeaderboard(scope: LeaderboardScope, board: string, mode?: SeasonMode) {
  return useQuery({
    queryKey: ["leaderboard", scope, board, mode ?? "mine"],
    queryFn: () =>
      api<LeaderboardDto>(
        `/leaderboards?scope=${scope}&board=${board}${mode ? `&mode=${mode}` : ""}`,
      ),
  });
}
