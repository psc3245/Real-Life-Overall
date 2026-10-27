import type {
  ReportChartDto,
  ReportDto,
  ReportOptions,
  ReportRange,
  ReportRunDto,
  ReportRunSummaryDto,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const reportsKey = ["reports"] as const;

export function useReports() {
  return useQuery({ queryKey: reportsKey, queryFn: () => api<ReportDto[]>("/reports") });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: [...reportsKey, id],
    queryFn: () => api<ReportDto>(`/reports/${id}`),
  });
}

export function useReportRuns(id: string) {
  return useQuery({
    queryKey: [...reportsKey, id, "runs"],
    queryFn: () => api<ReportRunSummaryDto[]>(`/reports/${id}/runs`),
  });
}

export function useReportRun(runId: string | null) {
  return useQuery({
    queryKey: [...reportsKey, "run", runId],
    queryFn: () => api<ReportRunDto>(`/reports/runs/${runId}`),
    enabled: runId !== null,
    staleTime: Infinity, // runs are snapshots
  });
}

export interface ReportInput {
  name: string;
  description: string;
  charts: ReportChartDto[];
  options: ReportOptions;
  defaultRange: Exclude<ReportRange, "custom">;
}

function useReportMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reportsKey }),
  });
}

export function useCreateReport() {
  return useReportMutation((input: ReportInput) =>
    api<ReportDto>("/reports", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateReport() {
  return useReportMutation(({ id, ...input }: Partial<ReportInput> & { id: string }) =>
    api<ReportDto>(`/reports/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export function useDeleteReport() {
  return useReportMutation((id: string) => api<null>(`/reports/${id}`, { method: "DELETE" }));
}

export function useRunReport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      range: ReportRange;
      from?: string;
      to?: string;
      options: ReportOptions;
    }) => api<ReportRunDto>(`/reports/${id}/run`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async (run) => {
      queryClient.setQueryData([...reportsKey, "run", run.id], run);
      await queryClient.invalidateQueries({ queryKey: reportsKey });
    },
  });
}

export function useDeleteReportRun(reportId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => api<null>(`/reports/runs/${runId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...reportsKey, reportId] }),
  });
}
