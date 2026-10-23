import type { FriendDto } from "@rlo/shared";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { useFriendAction, useFriends } from "../../api/social";
import { Button } from "../../components/Button";
import { OvrBadge } from "../../components/OvrBadge";
import { ErrorNote } from "../onboarding/ErrorNote";

export function FriendsPage() {
  const friends = useFriends();
  const action = useFriendAction();
  const [username, setUsername] = useState("");

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const name = username.trim().replace(/^@/, "").toLowerCase();
    if (!name) return;
    action.mutate({ username: name, action: "add" }, { onSuccess: () => setUsername("") });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10 pt-4">
      <div className="space-y-4">
        <h1 className="font-display text-4xl font-bold uppercase">Friends</h1>
        <form onSubmit={onAdd} className="flex gap-2" aria-label="Add a friend">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Their username"
            aria-label="Username"
            autoCapitalize="none"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-lg border border-court-700 bg-court-950 px-3 py-2.5 outline-none focus:border-neon"
          />
          <Button type="submit" variant="primary" disabled={!username.trim() || action.isPending}>
            Add
          </Button>
        </form>
        <ErrorNote error={action.error} />
        {action.isSuccess && action.data.state === "outgoing" && (
          <p className="text-sm text-neon">Request sent.</p>
        )}
      </div>

      {friends.isPending && <p className="text-court-500">Loading…</p>}
      <ErrorNote error={friends.error} />
      {friends.data && (
        <>
          {friends.data.incoming.length > 0 && (
            <Section title="Requests">
              {friends.data.incoming.map((f) => (
                <Row key={f.username} friend={f}>
                  <Button
                    variant="primary"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ username: f.username, action: "add" })}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ username: f.username, action: "remove" })}
                  >
                    Decline
                  </Button>
                </Row>
              ))}
            </Section>
          )}

          <Section title={`Friends (${friends.data.friends.length})`}>
            {friends.data.friends.length === 0 && (
              <p className="text-sm text-court-500">
                No friends yet. Add someone by username, or send them your profile link from
                Settings.
              </p>
            )}
            {friends.data.friends.map((f) => (
              <Row key={f.username} friend={f}>
                {f.card && (
                  <Link
                    to={`/compare/${f.username}`}
                    className="rounded-lg border border-court-500 px-4 py-2 text-sm hover:border-neon hover:text-neon"
                  >
                    Compare
                  </Link>
                )}
              </Row>
            ))}
          </Section>

          {friends.data.outgoing.length > 0 && (
            <Section title="Sent">
              {friends.data.outgoing.map((f) => (
                <Row key={f.username} friend={f}>
                  <Button
                    variant="ghost"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ username: f.username, action: "remove" })}
                  >
                    Cancel
                  </Button>
                </Row>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl uppercase tracking-wider">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function Row({ friend, children }: { friend: FriendDto; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border border-court-700 bg-court-900/70 p-3">
      {friend.card ? (
        <OvrBadge value={friend.card.overall} size="md" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-court-700 font-display text-xl text-court-500">
          –
        </span>
      )}
      <Link to={`/u/${friend.username}`} className="min-w-[9rem] flex-1 hover:text-neon">
        <p className="truncate font-display text-lg uppercase">{friend.displayName}</p>
        <p className="truncate text-sm text-court-500">
          @{friend.username}
          {friend.card?.archetype && ` · ${friend.card.archetype}`}
        </p>
      </Link>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </li>
  );
}
