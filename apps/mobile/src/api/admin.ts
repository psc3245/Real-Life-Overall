import type {
  AdminOverviewDto,
  AdminUserDto,
  LlmCallDto,
  RecapDebugDto,
  UserRole,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useAuthState } from "./session";
import { useMe } from "./hooks";

export const adminKey = ["admin"] as const;

export function useIsAdmin() {
  const { signedIn } = useAuthState();
  return useMe(signedIn).data?.role === "admin";
}

export function useAdminOverview() {
  return useQuery({
    queryKey: [...adminKey, "overview"],
    queryFn: () => api<AdminOverviewDto>("/admin/overview"),
  });
}

export function useLlmCalls(filter: { errorsOnly?: boolean; userId?: string; limit?: number }) {
  const params = new URLSearchParams({ limit: String(filter.limit ?? 50) });
  if (filter.errorsOnly) params.set("errors", "1");
  if (filter.userId) params.set("userId", filter.userId);
  return useQuery({
    queryKey: [...adminKey, "calls", filter],
    queryFn: () => api<LlmCallDto[]>(`/admin/llm-calls?${params}`),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: [...adminKey, "users"],
    queryFn: () => api<AdminUserDto[]>("/admin/users"),
  });
}

export function useSetRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      api<null>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...adminKey, "users"] }),
  });
}

export function useRecapDebug(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...adminKey, "recap", id],
    queryFn: () => api<RecapDebugDto>(`/admin/recaps/${id}`),
    enabled,
  });
}
