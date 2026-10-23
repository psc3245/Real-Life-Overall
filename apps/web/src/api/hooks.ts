import type { MeDto } from "@rlo/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export type Me = MeDto;

export const queryKeys = {
  health: ["health"] as const,
  me: ["me"] as const,
};

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: () => api<{ ok: boolean }>("/health") });
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api<Me>("/me"), enabled });
}
