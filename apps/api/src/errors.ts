import { HTTPException } from "hono/http-exception";

export const badRequest = (message: string) => new HTTPException(400, { message });
export const notFound = (message: string) => new HTTPException(404, { message });
export const conflict = (message: string) => new HTTPException(409, { message });

/** Postgres unique violation (23505), looking through driver/ORM error wrappers. */
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}
