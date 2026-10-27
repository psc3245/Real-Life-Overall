import type {
  ScoutingReportBody,
  ScoutingReportDto,
  TreeProposalDto,
  WeightsDto,
} from "@rlo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import { ratingsKey } from "./ratings";
import { weeklyKey } from "./weekly";

export const scoutingReportKey = ["scouting-report"] as const;
export const weightsKey = ["weights"] as const;
export const treeProposalsKey = ["tree-proposals"] as const;

export function useScoutingReport() {
  return useQuery({
    queryKey: scoutingReportKey,
    queryFn: () => api<ScoutingReportDto>("/scouting-report"),
  });
}

export function useSaveScoutingReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScoutingReportBody) =>
      api<ScoutingReportDto>("/scouting-report", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: (report) => queryClient.setQueryData(scoutingReportKey, report),
  });
}

export function useWeights() {
  return useQuery({ queryKey: weightsKey, queryFn: () => api<WeightsDto>("/weights") });
}

export function useUndoWeightChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<WeightsDto>(`/weights/changes/${id}/undo`, { method: "POST" }),
    onSuccess: async (weights) => {
      queryClient.setQueryData(weightsKey, weights);
      await Promise.all(
        [ratingsKey, weeklyKey].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}

export function useTreeProposals() {
  return useQuery({
    queryKey: treeProposalsKey,
    queryFn: () => api<TreeProposalDto[]>("/tree-proposals"),
  });
}

export function useResolveTreeProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "dismiss" }) =>
      api<TreeProposalDto>(`/tree-proposals/${id}/${action}`, { method: "POST" }),
    // A new tree touches almost everything (ratings, habits' links, charts, the report's links).
    onSuccess: (_, { action }) =>
      action === "accept"
        ? queryClient.invalidateQueries()
        : Promise.all(
            [treeProposalsKey, weeklyKey].map((queryKey) =>
              queryClient.invalidateQueries({ queryKey }),
            ),
          ),
  });
}
