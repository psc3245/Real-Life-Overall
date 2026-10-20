import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";

export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Request body must be JSON" });
  }
  return schema.parse(body);
}

/** Like parseJson, but an empty body yields undefined. */
export async function parseOptionalJson<T extends z.ZodType>(
  c: Context,
  schema: T,
): Promise<z.infer<T> | undefined> {
  const text = await c.req.text();
  if (!text.trim()) return undefined;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HTTPException(400, { message: "Request body must be JSON" });
  }
  return schema.parse(body);
}
