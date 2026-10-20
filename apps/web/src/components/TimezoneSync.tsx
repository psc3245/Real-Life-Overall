import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "../api/client";
import { useMe } from "../api/hooks";

/**
 * Accounts start on UTC, which makes "today" wrong for most people. The first time we see a
 * user still on the default, adopt the browser's timezone. A deliberate non-UTC choice is kept.
 */
export function TimezoneSync() {
  const me = useMe();
  const queryClient = useQueryClient();
  const synced = useRef<string | null>(null);
  const update = useMutation({
    mutationFn: (timezone: string) =>
      api("/me", { method: "PATCH", body: JSON.stringify({ timezone }) }),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const user = me.data;
    if (!user || !browser || browser === "UTC" || synced.current === user.id) return;
    synced.current = user.id;
    if (user.timezone === "UTC") update.mutate(browser);
  }, [me.data, update]);

  return null;
}
