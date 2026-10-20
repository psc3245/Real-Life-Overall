import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface Me {
  id: string;
  username: string;
  displayName: string;
  timezone: string;
  weekStart: number;
  createdAt: string;
}

export const queryKeys = {
  health: ["health"] as const,
  me: ["me"] as const,
};

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: () => api<{ ok: boolean }>("/health") });
}

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api<Me>("/me") });
}
