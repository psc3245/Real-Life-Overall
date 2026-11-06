import type {
  AccountAction,
  AdminOverviewDto,
  AdminUserDto,
  CreateAccountBody,
  LlmCallDto,
  RecapDebugDto,
  SeasonMode,
  UserRole,
} from "@rlo/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { useAuthState } from "./auth";
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

export function useAdminUsers(filter: { q?: string; role?: UserRole } = {}) {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.role) params.set("role", filter.role);
  return useQuery({
    queryKey: [...adminKey, "users", filter],
    queryFn: () => api<AdminUserDto[]>(`/admin/users?${params}`),
    // Keep the table while a new search loads, so typing doesn't flash it empty.
    placeholderData: keepPreviousData,
  });
}

/** After any account change: the user list and the overview's counts. */
function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKey });
}

export function useCreateAccount() {
  const onSuccess = useInvalidateAccounts();
  return useMutation({
    mutationFn: (body: CreateAccountBody) =>
      api<AdminUserDto>("/admin/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess,
  });
}

export function useDeleteAccount() {
  const onSuccess = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, confirm }: { id: string; confirm: string }) =>
      api<null>(`/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ confirm }) }),
    onSuccess,
  });
}

export function useAccountAction() {
  const onSuccess = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: AccountAction }) =>
      api<null>(`/admin/users/${id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onSuccess,
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

/** Switches an account's running season to another mode (clears its goals). */
export function useSetSeasonMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: SeasonMode }) =>
      api<null>(`/admin/users/${id}/season-mode`, {
        method: "PUT",
        body: JSON.stringify({ mode }),
      }),
    // Your own season may have changed too.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useRecapDebug(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...adminKey, "recap", id],
    queryFn: () => api<RecapDebugDto>(`/admin/recaps/${id}`),
    enabled,
  });
}
