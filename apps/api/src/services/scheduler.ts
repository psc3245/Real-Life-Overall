import { addDays, BACKFILL_DAYS, localDateIn, MAX_RECAPS_PER_DAY } from "@rlo/shared";
import type { Database } from "../db/client";
import type { LlmClient } from "../llm/client";
import * as recapRepo from "../repos/recap-repo";
import * as seasonRepo from "../repos/season-repo";
import { getDay } from "./day-service";
import { applyDecay } from "./decay-service";
import { hasContent, runDailyRecap } from "./recap-service";

/** Local hour when forgotten days get recapped automatically (DESIGN.md §8.6). */
export const AUTO_RECAP_HOUR = 4;

export function localHour(timeZone: string, now: Date): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" })
    .formatToParts(now)
    .find((p) => p.type === "hour")!.value;
  return Number(hour);
}

export interface UserRunResult {
  userId: string;
  recapped: string[];
  failed: string[];
  decayDays: number;
}

/**
 * Recaps days in the backfill window that have content but no current recap (oldest first, so
 * each recap sees the previous one), then brings decay up to date.
 */
export async function runForUser(
  db: Database,
  llm: LlmClient,
  userId: string,
  timezone: string,
  { recap }: { recap: boolean },
): Promise<UserRunResult> {
  const result: UserRunResult = { userId, recapped: [], failed: [], decayDays: 0 };
  if (recap) {
    const today = localDateIn(timezone);
    for (let date = addDays(today, -BACKFILL_DAYS); date < today; date = addDays(date, 1)) {
      const day = await getDay(db, userId, date);
      if (day.status === "recapped" || !hasContent(day)) continue;
      if ((await recapRepo.countDaily(db, userId, date)) >= MAX_RECAPS_PER_DAY) continue;
      try {
        await runDailyRecap(db, llm, userId, date);
        result.recapped.push(date);
      } catch (error) {
        console.error(`auto-recap failed for ${userId} on ${date}`, error);
        result.failed.push(date);
      }
    }
  }
  result.decayDays = await applyDecay(db, userId);
  return result;
}

/** The hourly job: every active user gets decay; users at their recap hour get auto-recaps. */
export async function runHourly(db: Database, llm: LlmClient, now = new Date()) {
  const users = await seasonRepo.findActiveUsers(db);
  const results: UserRunResult[] = [];
  for (const u of users) {
    try {
      const recap = localHour(u.timezone, now) === AUTO_RECAP_HOUR;
      results.push(await runForUser(db, llm, u.userId, u.timezone, { recap }));
    } catch (error) {
      console.error(`scheduled run failed for ${u.userId}`, error);
    }
  }
  return results;
}
