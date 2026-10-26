import { chartViewBodySchema, chartViewUpdateSchema, metricSeriesQuerySchema } from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import * as charts from "../services/chart-service";
import * as metrics from "../services/metrics-service";
import { idParam, parseJson } from "../validation";

/** Charts for everything (DESIGN.md §7.7). */
export const metricRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await metrics.catalog(c.get("db"), c.get("userId"))))
  .get("/series", async (c) => {
    const q = metricSeriesQuerySchema.parse(c.req.query());
    return c.json(
      await metrics.series(c.get("db"), c.get("userId"), q.ids, { from: q.from, to: q.to }),
    );
  });

export const chartViewRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await charts.listViews(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, chartViewBodySchema);
    return c.json(await charts.createView(c.get("db"), c.get("userId"), body), 201);
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, chartViewUpdateSchema);
    return c.json(
      await charts.updateView(c.get("db"), c.get("userId"), idParam(c, "id", "Chart"), body),
    );
  })
  .delete("/:id", async (c) => {
    await charts.deleteView(c.get("db"), c.get("userId"), idParam(c, "id", "Chart"));
    return c.body(null, 204);
  });
