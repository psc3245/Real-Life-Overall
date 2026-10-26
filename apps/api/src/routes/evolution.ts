import { scoutingReportBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { badRequest } from "../errors";
import * as evolution from "../services/evolution-service";
import { idParam, parseJson } from "../validation";

/** The Scouting Report: what the player wants out of life (DESIGN.md §5.8). */
export const scoutingReportRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await evolution.getScoutingReport(c.get("db"), c.get("userId"))))
  .put("/", async (c) => {
    const body = await parseJson(c, scoutingReportBodySchema);
    return c.json(await evolution.saveScoutingReport(c.get("db"), c.get("userId"), body));
  });

/** Weights as they evolve through the season, and undoing a shift (DESIGN.md §4.5). */
export const weightRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await evolution.getWeights(c.get("db"), c.get("userId"))))
  .post("/changes/:id/undo", async (c) =>
    c.json(
      await evolution.undoWeightChange(
        c.get("db"),
        c.get("userId"),
        idParam(c, "id", "Weight change"),
      ),
    ),
  );

/** Tree changes proposed by weekly reviews. */
export const treeProposalRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await evolution.listTreeProposals(c.get("db"), c.get("userId"))))
  .post("/:id/:action", async (c) => {
    const id = idParam(c, "id", "Proposal");
    const action = c.req.param("action");
    if (action !== "accept" && action !== "dismiss") throw badRequest("Use /accept or /dismiss");
    return c.json(
      await evolution.resolveTreeProposal(c.get("db"), c.get("llm"), c.get("userId"), id, action),
    );
  });
