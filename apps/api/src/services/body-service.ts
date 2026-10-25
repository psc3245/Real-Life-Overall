import {
  isValidDate,
  localDateIn,
  type BodyDto,
  type BodyEntryDto,
  type BodyKind,
  type DayBodyDto,
} from "@rlo/shared";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as bodyRepo from "../repos/body-repo";
import * as userRepo from "../repos/user-repo";
import type { PublicUser } from "../repos/user-repo";

async function userOf(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return user;
}

/** Every logged day with its weight and height, newest first. */
export async function getBody(db: Database, userId: string): Promise<BodyDto> {
  const [user, rows] = await Promise.all([userOf(db, userId), bodyRepo.findAll(db, userId)]);
  const byDate = new Map<string, BodyEntryDto>();
  for (const r of rows) {
    const entry = byDate.get(r.localDate) ?? {
      localDate: r.localDate,
      weightKg: null,
      heightCm: null,
    };
    if (r.kind === "weight") entry.weightKg = r.value;
    else entry.heightCm = r.value;
    byDate.set(r.localDate, entry);
  }
  return {
    unitSystem: user.unitSystem,
    trackWeight: user.trackWeight,
    trackHeight: user.trackHeight,
    entries: [...byDate.values()],
  };
}

/** The day log's body section, or null when nothing is tracked. */
export async function bodyForDay(
  db: Database,
  user: PublicUser,
  date: string,
): Promise<DayBodyDto | null> {
  if (!user.trackWeight && !user.trackHeight) return null;
  const [rows, lastWeight, lastHeight] = await Promise.all([
    bodyRepo.findOn(db, user.id, date),
    bodyRepo.findLatestBefore(db, user.id, "weight", date),
    bodyRepo.findLatestBefore(db, user.id, "height", date),
  ]);
  return {
    trackWeight: user.trackWeight,
    trackHeight: user.trackHeight,
    weightKg: rows.find((r) => r.kind === "weight")?.value ?? null,
    heightCm: rows.find((r) => r.kind === "height")?.value ?? null,
    lastWeightKg: lastWeight?.value ?? null,
    lastHeightCm: lastHeight?.value ?? null,
  };
}

/** Sets (or, with null, clears) a day's weight and/or height. Any past day works. */
export async function saveBody(
  db: Database,
  userId: string,
  date: string,
  input: { weightKg?: number | null; heightCm?: number | null },
) {
  const user = await userOf(db, userId);
  if (!isValidDate(date)) throw badRequest("Invalid date");
  if (date > localDateIn(user.timezone)) throw badRequest("Can't log days in the future");
  const changes: [BodyKind, number | null | undefined, boolean][] = [
    ["weight", input.weightKg, user.trackWeight],
    ["height", input.heightCm, user.trackHeight],
  ];
  for (const [kind, value, tracked] of changes) {
    if (value === undefined) continue;
    if (!tracked && value !== null) throw conflict(`Turn on ${kind} tracking in settings first`);
    if (value === null) await bodyRepo.remove(db, userId, date, kind);
    else await bodyRepo.upsert(db, userId, date, kind, Math.round(value * 1000) / 1000);
  }
  return getBody(db, userId);
}
