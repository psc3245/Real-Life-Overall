import {
  MAX_HABIT_BUCKETS,
  type habitBucketBodySchema,
  type HabitBucketDto,
  type habitBucketOrderBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, conflict, notFound } from "../errors";
import * as bucketRepo from "../repos/habit-bucket-repo";
import type { HabitBucketRow } from "../repos/habit-bucket-repo";

const toDto = (row: HabitBucketRow): HabitBucketDto => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sortOrder,
});

export async function listBuckets(db: Database, userId: string): Promise<HabitBucketDto[]> {
  return (await bucketRepo.findAllByUser(db, userId)).map(toDto);
}

export async function createBucket(
  db: Database,
  userId: string,
  input: z.infer<typeof habitBucketBodySchema>,
): Promise<HabitBucketDto> {
  const existing = await bucketRepo.findAllByUser(db, userId);
  if (existing.length >= MAX_HABIT_BUCKETS) {
    throw conflict(`You can have up to ${MAX_HABIT_BUCKETS} buckets`);
  }
  if (existing.some((b) => b.name.toLowerCase() === input.name.toLowerCase())) {
    throw conflict(`You already have a bucket called ${input.name}`);
  }
  const sortOrder = Math.max(-1, ...existing.map((b) => b.sortOrder)) + 1;
  return toDto(await bucketRepo.insert(db, { userId, name: input.name, sortOrder }));
}

export async function renameBucket(
  db: Database,
  userId: string,
  id: string,
  input: z.infer<typeof habitBucketBodySchema>,
): Promise<HabitBucketDto> {
  const bucket = await bucketRepo.findById(db, userId, id);
  if (!bucket) throw notFound("Bucket not found");
  const existing = await bucketRepo.findAllByUser(db, userId);
  if (existing.some((b) => b.id !== id && b.name.toLowerCase() === input.name.toLowerCase())) {
    throw conflict(`You already have a bucket called ${input.name}`);
  }
  return toDto(await bucketRepo.update(db, id, { name: input.name }));
}

/** Sets the order from a full list of the player's bucket ids. */
export async function reorderBuckets(
  db: Database,
  userId: string,
  input: z.infer<typeof habitBucketOrderBodySchema>,
): Promise<HabitBucketDto[]> {
  const existing = await bucketRepo.findAllByUser(db, userId);
  const ids = new Set(input.ids);
  if (ids.size !== existing.length || existing.some((b) => !ids.has(b.id))) {
    throw badRequest("List every bucket exactly once");
  }
  await db.transaction(async (tx) => {
    for (const [sortOrder, id] of input.ids.entries()) {
      await bucketRepo.update(tx, id, { sortOrder });
    }
  });
  return listBuckets(db, userId);
}

/** Its habits stay, unfiled. */
export async function deleteBucket(db: Database, userId: string, id: string): Promise<void> {
  const bucket = await bucketRepo.findById(db, userId, id);
  if (!bucket) throw notFound("Bucket not found");
  await bucketRepo.remove(db, id);
}

/** Checks a bucket id from a habit body belongs to the player (null clears it). */
export async function requireBucket(
  db: Database,
  userId: string,
  id: string | null | undefined,
): Promise<string | null | undefined> {
  if (!id) return id;
  if (!(await bucketRepo.findById(db, userId, id))) throw badRequest("Unknown bucket");
  return id;
}
