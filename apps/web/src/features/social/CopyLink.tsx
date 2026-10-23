import { useState } from "react";
import { Button } from "../../components/Button";

export const profileUrl = (username: string) => `${window.location.origin}/u/${username}`;

/** Copies a profile link; falls back to showing it when the clipboard is blocked. */
export function CopyLink({ username }: { username: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = profileUrl(username);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  };
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button onClick={copy}>{state === "copied" ? "Link copied" : "Copy link"}</Button>
      {state === "failed" && <code className="break-all text-sm text-court-300">{url}</code>}
    </span>
  );
}
