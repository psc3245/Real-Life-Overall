import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { getDevUser, setDevUser } from "../api/client";

/** Stand-in for auth until a provider is chosen: pick which dev user the API sees. */
export function DevUserSwitcher() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(getDevUser);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const username = value.trim().toLowerCase();
    if (!username) return;
    setDevUser(username);
    queryClient.invalidateQueries();
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 text-xs">
      <label htmlFor="dev-user" className="uppercase tracking-wider text-court-500">
        Dev user
      </label>
      <input
        id="dev-user"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        pattern="[a-zA-Z0-9_\-]{1,32}"
        className="w-24 rounded-md border border-court-700 bg-court-900 px-2 py-1 text-court-100 outline-none focus:border-neon"
      />
    </form>
  );
}
