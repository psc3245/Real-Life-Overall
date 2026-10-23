import { setGoalBodySchema } from "@rlo/shared";
import { Hono, type Context } from "hono";
import type { AppEnv } from "../context";
import { notFound } from "../errors";
import * as goalRepo from "../repos/goal-repo";
import { loadLeafContext } from "../services/habit-service";
import { idParam, parseJson } from "../validation";

/** Goals target a node in the user's active season: Overall, a category or an attribute. */
async function ownNode(c: Context<AppEnv>) {
  const nodeId = idParam(c, "nodeId", "Rating");
  const ctx = await loadLeafContext(c.get("db"), c.get("userId"));
  if (!ctx || !ctx.nodes.some((n) => n.id === nodeId)) throw notFound("Rating not found");
  return nodeId;
}

export const goalRoutes = new Hono<AppEnv>()
  .put("/:nodeId", async (c) => {
    const nodeId = await ownNode(c);
    const { target } = await parseJson(c, setGoalBodySchema);
    await goalRepo.upsert(c.get("db"), nodeId, Math.round(target * 10) / 10);
    return c.body(null, 204);
  })
  .delete("/:nodeId", async (c) => {
    await goalRepo.remove(c.get("db"), await ownNode(c));
    return c.body(null, 204);
  });
