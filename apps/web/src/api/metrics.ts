import type { ChartConfig, ChartViewDto, MetricDto, MetricSeriesResponseDto } from "@rlo/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";

export const metricsKey = ["metrics"] as const;
export const chartViewsKey = ["chart-views"] as const;

/** Every metric the user can chart. */
export function useMetrics() {
  return useQuery({ queryKey: metricsKey, queryFn: () => api<MetricDto[]>("/metrics") });
}

export function useMetricSeries(ids: string[], from: string | null, to?: string) {
  const params = new URLSearchParams({ ids: ids.join(",") });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return useQuery({
    queryKey: [...metricsKey, "series", ids, from, to ?? null],
    queryFn: () => api<MetricSeriesResponseDto>(`/metrics/series?${params}`),
    enabled: ids.length > 0 && from !== null,
    placeholderData: keepPreviousData,
  });
}

export function useChartViews() {
  return useQuery({ queryKey: chartViewsKey, queryFn: () => api<ChartViewDto[]>("/chart-views") });
}

function useViewMutation<TInput, TOutput>(request: (input: TInput) => Promise<TOutput>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chartViewsKey }),
  });
}

export function useSaveChartView() {
  return useViewMutation((input: ChartConfig & { name: string; pinned?: boolean }) =>
    api<ChartViewDto>("/chart-views", { method: "POST", body: JSON.stringify(input) }),
  );
}

export function useUpdateChartView() {
  return useViewMutation(
    ({ id, ...input }: Partial<ChartConfig> & { id: string; name?: string; pinned?: boolean }) =>
      api<ChartViewDto>(`/chart-views/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  );
}

export function useDeleteChartView() {
  return useViewMutation((id: string) => api<null>(`/chart-views/${id}`, { method: "DELETE" }));
}
