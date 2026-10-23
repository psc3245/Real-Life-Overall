import {
  LEADERBOARD_MIN_RECAPPED_DAYS,
  LEADERBOARD_SIZE,
  leaderboardIneligibility,
  localDateIn,
  seasonForDate,
  type LeaderboardDto,
  type LeaderboardEntryDto,
  type LeaderboardScope,
  type PublicCategoryDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { notFound } from "../errors";
import * as cardRepo from "../repos/card-repo";
import * as friendshipRepo from "../repos/friendship-repo";
import * as userRepo from "../repos/user-repo";

type BoardRow = Awaited<ReturnType<typeof cardRepo.findGlobal>>[number];

/** The row's value on a board: Overall, or a template category's value (absent: not ranked). */
function boardValue(row: BoardRow, board: string): number | null {
  if (board === "overall") return row.overall;
  const category = (row.categories as PublicCategoryDto[]).find((c) => c.templateKey === board);
  return category?.value ?? null;
}

/** Highest first; ties share a rank (1, 2, 2, 4). */
export function rank(
  rows: { value: number; recappedDays: number; username: string }[],
): { index: number; rank: number }[] {
  const order = rows
    .map((r, index) => ({ r, index }))
    .sort(
      (a, b) =>
        b.r.value - a.r.value ||
        b.r.recappedDays - a.r.recappedDays ||
        a.r.username.localeCompare(b.r.username),
    );
  let last: number | null = null;
  let lastRank = 0;
  return order.map(({ r, index }, i) => {
    if (r.value !== last) lastRank = i + 1;
    last = r.value;
    return { index, rank: lastRank };
  });
}

/**
 * Friends boards: you plus friends who share their card with friends (provisional players
 * included and marked). Global boards: public, opted-in players whose ratings are backed by
 * enough recaps and aren't frequently flagged (DESIGN.md §7.3).
 */
export async function getLeaderboard(
  db: Database,
  userId: string,
  scope: LeaderboardScope,
  board: string,
): Promise<LeaderboardDto> {
  const me = await userRepo.findById(db, userId);
  if (!me) throw notFound("User not found");
  const seasonLabel = seasonForDate(localDateIn(me.timezone)).label;
  const myCard = await cardRepo.findByUser(db, userId);

  let rows: BoardRow[];
  if (scope === "friends") {
    const friendIds = await friendshipRepo.findFriendIds(db, userId);
    rows = (await cardRepo.findForPlayers(db, [userId, ...friendIds], seasonLabel)).filter(
      (r) => r.userId === userId || r.visibility !== "private",
    );
  } else {
    rows = (await cardRepo.findGlobal(db, seasonLabel)).filter(
      (r) => leaderboardIneligibility(r).length === 0,
    );
  }

  const scored = rows.flatMap((r) => {
    const value = boardValue(r, board);
    return value == null ? [] : [{ row: r, value }];
  });
  const ranked = rank(
    scored.map((s) => ({
      value: s.value,
      recappedDays: s.row.recappedDays,
      username: s.row.username,
    })),
  );
  const entries: LeaderboardEntryDto[] = ranked.map(({ index, rank: position }) => {
    const { row, value } = scored[index]!;
    return {
      rank: position,
      username: row.username,
      displayName: row.displayName,
      archetype: row.archetype,
      value,
      recappedDays: row.recappedDays,
      provisional: row.recappedDays < LEADERBOARD_MIN_RECAPPED_DAYS,
      isMe: row.userId === userId,
    };
  });

  return {
    scope,
    board,
    seasonLabel,
    entries: entries.slice(0, LEADERBOARD_SIZE),
    me: entries.find((e) => e.isMe) ?? null,
    globalStatus: {
      optedIn: me.leaderboardOptIn,
      visibility: me.profileVisibility,
      hasCard: myCard?.seasonLabel === seasonLabel,
      reasons: myCard ? leaderboardIneligibility(myCard) : [],
      recappedDays: myCard?.recappedDays ?? 0,
    },
  };
}
