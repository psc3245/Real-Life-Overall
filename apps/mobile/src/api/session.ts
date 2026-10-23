import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient } from "./auth";
import { api } from "./client";

export interface AuthConfig {
  mode: "dev" | "better-auth";
  google: boolean;
}

export function useAuthConfig() {
  return useQuery({
    queryKey: ["auth-config"],
    queryFn: () => api<AuthConfig>("/auth-config"),
    staleTime: Infinity,
  });
}

/** Whether the player can use the app. Dev mode is always "signed in" as the dev user. */
export function useAuthState() {
  const config = useAuthConfig();
  const session = authClient.useSession();
  if (config.isPending) return { loading: true, signedIn: false, mode: null } as const;
  if (config.isError) {
    return { loading: false, signedIn: false, mode: null, error: config.error } as const;
  }
  if (config.data.mode === "dev") return { loading: false, signedIn: true, mode: "dev" } as const;
  return {
    loading: session.isPending,
    signedIn: Boolean(session.data),
    mode: "better-auth",
    user: session.data?.user ?? null,
  } as const;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
  };
}
