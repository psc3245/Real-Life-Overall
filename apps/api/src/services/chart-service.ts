import type { ChartConfig, ChartViewDto, chartViewBodySchema } from "@rlo/shared";
import type { z } from "zod";
import type { Database } from "../db/client";
import { notFound } from "../errors";
import * as chartRepo from "../repos/chart-repo";
import type { ChartViewRow } from "../repos/chart-repo";

type Body = z.infer<typeof chartViewBodySchema>;

const toDto = (row: ChartViewRow): ChartViewDto => ({
  ...(row.config as ChartConfig),
  id: row.id,
  name: row.name,
  pinned: row.pinned,
});

const CONFIG_KEYS = ["metricIds", "range", "bucket", "style", "average", "trend"] as const;

/** The chart settings in a body (everything but name and pinned). */
const configOf = (b: Partial<Body>): Partial<ChartConfig> =>
  Object.fromEntries(CONFIG_KEYS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]]));

export async function listViews(db: Database, userId: string): Promise<ChartViewDto[]> {
  return (await chartRepo.findByUser(db, userId)).map(toDto);
}

export async function createView(db: Database, userId: string, body: Body): Promise<ChartViewDto> {
  return toDto(
    await chartRepo.insert(db, {
      userId,
      name: body.name,
      pinned: body.pinned,
      config: configOf(body),
    }),
  );
}

export async function updateView(
  db: Database,
  userId: string,
  id: string,
  body: Partial<Body>,
): Promise<ChartViewDto> {
  const row = await chartRepo.findById(db, userId, id);
  if (!row) throw notFound("Chart not found");
  return toDto(
    await chartRepo.update(db, row.id, {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.pinned !== undefined && { pinned: body.pinned }),
      config: { ...(row.config as ChartConfig), ...configOf(body) },
    }),
  );
}

export async function deleteView(db: Database, userId: string, id: string) {
  const row = await chartRepo.findById(db, userId, id);
  if (!row) throw notFound("Chart not found");
  await chartRepo.remove(db, row.id);
}
