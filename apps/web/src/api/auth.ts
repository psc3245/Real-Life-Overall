import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { api } from "./client";

/** Better Auth client; same origin as the app (the dev server proxies /api). */
export const authClient = createAuthClient({ basePath: "/api/auth" });

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

/** Whether the visitor can use private pages. Dev mode is always "signed in" as the dev user. */
export function useAuthState() {
  const config = useAuthConfig();
  const session = authClient.useSession();
  if (config.isPending) return { loading: true, signedIn: false, mode: null, name: null } as const;
  if (config.data?.mode === "dev") {
    return { loading: false, signedIn: true, mode: "dev", name: null } as const;
  }
  return {
    loading: session.isPending,
    signedIn: Boolean(session.data),
    mode: "better-auth",
    name: session.data?.user.name ?? null,
  } as const;
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
  };
}
