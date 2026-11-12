import {
  acceptSuggestionBodySchema,
  coachMessageBodySchema,
  postgameBodySchema,
} from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { badRequest } from "../errors";
import * as coach from "../services/coach-service";
import { idParam, idParamValue, parseJson } from "../validation";

/** The coach chat (DESIGN.md §5.9). */
export const coachRoutes = new Hono<AppEnv>()
  // ?thread=<id>, ?thread=new for an empty new chat, or nothing for the latest thread.
  .get("/", async (c) => {
    const thread = c.req.query("thread");
    const id = thread === "new" ? null : thread ? idParamValue(thread, "Conversation") : undefined;
    return c.json(await coach.getCoach(c.get("db"), c.get("userId"), id));
  })
  .delete("/", async (c) => c.json(await coach.clearCoach(c.get("db"), c.get("userId"))))
  .get("/threads", async (c) => c.json(await coach.listThreads(c.get("db"), c.get("userId"))))
  .delete("/threads/:id", async (c) => {
    await coach.deleteThread(c.get("db"), c.get("userId"), idParam(c, "id", "Conversation"));
    return c.body(null, 204);
  })
  .post("/messages", async (c) => {
    const { content, threadId } = await parseJson(c, coachMessageBodySchema);
    return c.json(
      await coach.sendMessage(c.get("db"), c.get("llm"), c.get("userId"), content, threadId),
    );
  })
  .post("/postgame", async (c) => {
    const { date } = await parseJson(c, postgameBodySchema);
    return c.json(await coach.startPostgame(c.get("db"), c.get("llm"), c.get("userId"), date));
  })
  .post("/messages/:id/actions/:index/undo", async (c) => {
    const id = idParam(c, "id", "Message");
    const index = Number(c.req.param("index"));
    if (!Number.isInteger(index)) throw badRequest("Use an action index");
    return c.json(await coach.undoAction(c.get("db"), c.get("userId"), id, index));
  })
  .post("/messages/:id/suggestions/:index/:action", async (c) => {
    const id = idParam(c, "id", "Message");
    const action = c.req.param("action");
    const index = Number(c.req.param("index"));
    if ((action !== "accept" && action !== "dismiss") || !Number.isInteger(index)) {
      throw badRequest("Use /accept or /dismiss with a suggestion index");
    }
    // Accepting may carry the player's edits; an empty body takes the proposal as it is.
    const { edits } =
      action === "accept" && c.req.header("content-type")?.includes("json")
        ? await parseJson(c, acceptSuggestionBodySchema)
        : { edits: undefined };
    return c.json(
      await coach.resolveSuggestion(c.get("db"), c.get("userId"), id, index, action, edits),
    );
  });
