import {
  dayOfWeek,
  localDateIn,
  MAX_CUSTOM_PROMPTS,
  type CustomPromptDto,
  type customPromptBodySchema,
  type updateCustomPromptBodySchema,
} from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { badRequest, notFound } from "../errors";
import * as customPromptRepo from "../repos/custom-prompt-repo";
import type { CustomPromptRow } from "../repos/custom-prompt-repo";

const toDto = (row: CustomPromptRow): CustomPromptDto => ({
  id: row.id,
  question: row.question,
  days: [...row.days].sort((a, b) => a - b),
});

export async function listCustomPrompts(db: Database, userId: string) {
  return (await customPromptRepo.findActiveByUser(db, userId)).map(toDto);
}

/**
 * The player's questions asked on `day`: scheduled that weekday and made by then (a new
 * question doesn't reach back into days already logged).
 */
export async function scheduledPrompts(
  db: Database,
  userId: string,
  day: string,
  timezone: string,
): Promise<CustomPromptDto[]> {
  const weekday = dayOfWeek(day);
  return (await customPromptRepo.findActiveByUser(db, userId))
    .filter((r) => r.days.includes(weekday) && localDateIn(timezone, r.createdAt) <= day)
    .map(toDto);
}

export async function createCustomPrompt(
  db: Database,
  userId: string,
  input: z.infer<typeof customPromptBodySchema>,
): Promise<CustomPromptDto> {
  const existing = await customPromptRepo.findActiveByUser(db, userId);
  if (existing.length >= MAX_CUSTOM_PROMPTS) {
    throw badRequest(`You can have up to ${MAX_CUSTOM_PROMPTS} questions`);
  }
  return toDto(await customPromptRepo.insert(db, { userId, ...input }));
}

export async function updateCustomPrompt(
  db: Database,
  userId: string,
  id: string,
  input: z.infer<typeof updateCustomPromptBodySchema>,
): Promise<CustomPromptDto> {
  const row = await customPromptRepo.findById(db, userId, id);
  if (!row || row.archivedAt) throw notFound("Question not found");
  return toDto(await customPromptRepo.update(db, row.id, input));
}

/** Archived, so days that answered it keep what was asked. */
export async function deleteCustomPrompt(db: Database, userId: string, id: string) {
  const row = await customPromptRepo.findById(db, userId, id);
  if (!row || row.archivedAt) throw notFound("Question not found");
  await customPromptRepo.update(db, row.id, { archivedAt: new Date() });
}
