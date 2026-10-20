import { HTTPException } from "hono/http-exception";

export const badRequest = (message: string) => new HTTPException(400, { message });
export const notFound = (message: string) => new HTTPException(404, { message });
export const conflict = (message: string) => new HTTPException(409, { message });
