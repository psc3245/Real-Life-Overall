import type { FriendshipState } from "@rlo/shared";
import { Link } from "react-router";
import { useFriendAction } from "../../api/social";
import { Button } from "../../components/Button";
import { ErrorNote } from "../onboarding/ErrorNote";

/** The friend actions for one player, matching where the two of you stand. */
export function FriendButtons({
  username,
  state,
  canCompare,
}: {
  username: string;
  state: FriendshipState;
  canCompare: boolean;
}) {
  const action = useFriendAction();
  const run = (a: "add" | "remove") => action.mutate({ username, action: a });
  const busy = action.isPending;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "none" && (
          <Button variant="primary" disabled={busy} onClick={() => run("add")}>
            Add friend
          </Button>
        )}
        {state === "outgoing" && (
          <>
            <span className="text-sm text-court-300">Request sent</span>
            <Button variant="ghost" disabled={busy} onClick={() => run("remove")}>
              Cancel
            </Button>
          </>
        )}
        {state === "incoming" && (
          <>
            <Button variant="primary" disabled={busy} onClick={() => run("add")}>
              Accept request
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => run("remove")}>
              Decline
            </Button>
          </>
        )}
        {state === "friends" && <span className="text-sm text-neon">✓ Friends</span>}
        {canCompare && (
          <Link
            to={`/compare/${username}`}
            className="rounded-lg border border-court-500 px-4 py-2 text-sm hover:border-neon hover:text-neon"
          >
            Compare
          </Link>
        )}
        {state === "friends" && (
          <Button variant="danger" disabled={busy} onClick={() => run("remove")}>
            Remove
          </Button>
        )}
      </div>
      <ErrorNote error={action.error} />
    </div>
  );
}
