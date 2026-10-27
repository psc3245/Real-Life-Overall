import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api } from "@/api/client";
import { useMe } from "@/api/hooks";

/**
 * Accounts start on UTC, which makes "today" wrong for most people. The first time we see a
 * player still on the default, adopt the phone's timezone (as the web does with the browser's).
 * A deliberate non-UTC choice is kept.
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
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const user = me.data;
    if (!user || !device || device === "UTC" || synced.current === user.id) return;
    synced.current = user.id;
    if (user.timezone === "UTC") update.mutate(device);
  }, [me.data, update]);

  return null;
}
