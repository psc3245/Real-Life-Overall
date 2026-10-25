import { createObjectiveBodySchema, updateObjectiveBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as objectives from "../services/objective-service";
import { idParam, parseJson } from "../validation";

/** Goals with a deadline (DESIGN.md §7.4). */
export const objectiveRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await objectives.listObjectives(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, createObjectiveBodySchema);
    return c.json(await objectives.createObjective(c.get("db"), c.get("userId"), body), 201);
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, updateObjectiveBodySchema);
    return c.json(
      await objectives.updateObjective(
        c.get("db"),
        c.get("userId"),
        idParam(c, "id", "Goal"),
        body,
      ),
    );
  })
  .delete("/:id", async (c) => {
    await objectives.archiveObjective(c.get("db"), c.get("userId"), idParam(c, "id", "Goal"));
    return c.body(null, 204);
  });
