import type { BugReportBody, BugReportDto, BugReportStatus } from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKey } from "./admin";
import { api } from "./client";

/** Dev and admin accounts send bug reports (DESIGN.md §8.9). */
export function useSendBugReport() {
  return useMutation({
    meta: { haptic: "success" },
    mutationFn: (body: BugReportBody) =>
      api<{ id: string }>("/bug-reports", { method: "POST", body: JSON.stringify(body) }),
  });
}

export function useBugReports(status: BugReportStatus | undefined) {
  return useQuery({
    queryKey: [...adminKey, "bug-reports", status ?? "all"],
    queryFn: () => api<BugReportDto[]>(`/admin/bug-reports${status ? `?status=${status}` : ""}`),
  });
}

export function useSetBugReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BugReportStatus }) =>
      api<null>(`/admin/bug-reports/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...adminKey, "bug-reports"] }),
  });
}
