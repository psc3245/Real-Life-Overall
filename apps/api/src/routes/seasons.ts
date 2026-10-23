import { treeDraftSchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { getRatings } from "../services/ratings-service";
import { editSeasonTree, getSeasonSetup, listSeasonCards } from "../services/season-service";
import { getSeasonDetail } from "../services/season-history-service";
import { idParam, parseJson } from "../validation";

export const seasonRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await listSeasonCards(c.get("db"), c.get("userId"))))
  .get("/setup", async (c) => c.json(await getSeasonSetup(c.get("db"), c.get("userId"))))
  .put("/setup/tree", async (c) => {
    const draft = await parseJson(c, treeDraftSchema);
    await editSeasonTree(c.get("db"), c.get("llm"), c.get("userId"), draft);
    return c.json(await getRatings(c.get("db"), c.get("userId")));
  })
  .get("/:id", async (c) =>
    c.json(await getSeasonDetail(c.get("db"), c.get("userId"), idParam(c, "id", "Season"))),
  );
