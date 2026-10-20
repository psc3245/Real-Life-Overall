import {
  addDays,
  BACKFILL_DAYS,
  localDateIn,
  type createPauseBodySchema,
  type PauseDto,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as pauseRepo from "../repos/pause-repo";
import type { PauseRow } from "../repos/pause-repo";
import * as userRepo from "../repos/user-repo";
import { applyDecay, invalidateDecay } from "./decay-service";

const toDto = (p: PauseRow): PauseDto => ({
  id: p.id,
  startsOn: p.startsOn,
  endsOn: p.endsOn,
  reason: p.reason,
});

async function todayFor(db: Database, userId: string) {
  const user = await userRepo.findById(db, userId);
  if (!user) throw notFound("User not found");
  return localDateIn(user.timezone);
}

const overlaps = (a: { startsOn: string; endsOn: string | null }, b: PauseRow) =>
  a.startsOn <= (b.endsOn ?? "9999-12-31") && b.startsOn <= (a.endsOn ?? "9999-12-31");

export async function listPauses(db: Database, userId: string): Promise<PauseDto[]> {
  return (await pauseRepo.findByUser(db, userId)).map(toDto);
}

/** Pauses may start up to the backfill window in the past, so a forgotten trip can be covered. */
export async function createPause(
  db: Database,
  userId: string,
  input: z.infer<typeof createPauseBodySchema>,
): Promise<PauseDto> {
  const today = await todayFor(db, userId);
  if (input.startsOn < addDays(today, -BACKFILL_DAYS)) {
    throw badRequest(`Pauses can start at most ${BACKFILL_DAYS} days ago`);
  }
  const existing = await pauseRepo.findByUser(db, userId);
  if (existing.some((p) => overlaps(input, p))) throw conflict("That overlaps an existing pause");
  const pause = await pauseRepo.insert(db, { userId, ...input });
  await invalidateDecay(db, userId, input.startsOn);
  await applyDecay(db, userId);
  return toDto(pause);
}

/**
 * Ends a pause after `endsOn`. Ending it before it started removes it; ending only works on
 * days still inside the backfill window, so decayed history isn't rewritten far back.
 */
export async function endPause(
  db: Database,
  userId: string,
  pauseId: string,
  endsOn: string,
): Promise<PauseDto | null> {
  const today = await todayFor(db, userId);
  const pause = (await pauseRepo.findByUser(db, userId)).find((p) => p.id === pauseId);
  if (!pause) throw notFound("Pause not found");
  const earliest = addDays(today, -BACKFILL_DAYS - 1);
  if (endsOn < earliest) throw badRequest("Too far in the past to change");
  if (pause.endsOn !== null && pause.endsOn < earliest) throw conflict("That pause is in the past");

  let result: PauseDto | null;
  if (endsOn < pause.startsOn) {
    await pauseRepo.remove(db, pause.id);
    result = null;
  } else {
    result = toDto(await pauseRepo.setEnd(db, pause.id, endsOn));
  }
  const changedFrom = addDays(
    pause.endsOn === null || endsOn < pause.endsOn ? endsOn : pause.endsOn,
    1,
  );
  await invalidateDecay(db, userId, endsOn < pause.startsOn ? pause.startsOn : changedFrom);
  await applyDecay(db, userId);
  return result;
}
