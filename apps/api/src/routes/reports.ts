import { reportBodySchema, runReportBodySchema, updateReportBodySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as reports from "../services/report-service";
import { idParam, parseJson, parseOptionalJson } from "../validation";

/** Reports: collections of charts run over a period (DESIGN.md §7.8). */
export const reportRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await reports.listReports(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, reportBodySchema);
    return c.json(await reports.createReport(c.get("db"), c.get("userId"), body), 201);
  })
  .get("/runs/:runId", async (c) =>
    c.json(await reports.getRun(c.get("db"), c.get("userId"), idParam(c, "runId", "Report run"))),
  )
  .delete("/runs/:runId", async (c) => {
    await reports.deleteRun(c.get("db"), c.get("userId"), idParam(c, "runId", "Report run"));
    return c.body(null, 204);
  })
  .get("/:id", async (c) =>
    c.json(await reports.getReport(c.get("db"), c.get("userId"), idParam(c, "id", "Report"))),
  )
  .patch("/:id", async (c) => {
    const body = await parseJson(c, updateReportBodySchema);
    return c.json(
      await reports.updateReport(c.get("db"), c.get("userId"), idParam(c, "id", "Report"), body),
    );
  })
  .delete("/:id", async (c) => {
    await reports.deleteReport(c.get("db"), c.get("userId"), idParam(c, "id", "Report"));
    return c.body(null, 204);
  })
  .get("/:id/runs", async (c) =>
    c.json(await reports.listRuns(c.get("db"), c.get("userId"), idParam(c, "id", "Report"))),
  )
  .post("/:id/run", async (c) => {
    const body = (await parseOptionalJson(c, runReportBodySchema)) ?? {};
    return c.json(
      await reports.runReport(
        c.get("db"),
        c.get("llm"),
        c.get("userId"),
        idParam(c, "id", "Report"),
        body,
      ),
      201,
    );
  });
