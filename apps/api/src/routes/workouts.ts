import {
  createTemplateBodySchema,
  exerciseBodySchema,
  finishWorkoutBodySchema,
  startWorkoutBodySchema,
  templateBodySchema,
  updateWorkoutBodySchema,
} from "@rlo/shared";
import { Hono } from "hono";
import type { AppEnv } from "../context";
import { notFound } from "../errors";
import * as workouts from "../services/workout-service";
import { idParam, parseJson, parseOptionalJson } from "../validation";

/** Exercise ids are catalog slugs or custom uuids. */
function exerciseParam(id: string | undefined) {
  if (!id || !/^[a-z0-9-]{1,64}$/i.test(id)) throw notFound("Exercise not found");
  return id;
}

/** Workout logging and templates (DESIGN.md §7.5). */
export const workoutRoutes = new Hono<AppEnv>()
  .get("/", async (c) =>
    c.json(await workouts.listHistory(c.get("db"), c.get("userId"), c.req.query("before"))),
  )
  .get("/active", async (c) => c.json(await workouts.getActive(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = (await parseOptionalJson(c, startWorkoutBodySchema)) ?? {};
    return c.json(await workouts.startWorkout(c.get("db"), c.get("userId"), body), 201);
  })
  .get("/:id", async (c) =>
    c.json(await workouts.getWorkout(c.get("db"), c.get("userId"), idParam(c, "id", "Workout"))),
  )
  .put("/:id", async (c) => {
    const body = await parseJson(c, updateWorkoutBodySchema);
    return c.json(
      await workouts.updateWorkout(c.get("db"), c.get("userId"), idParam(c, "id", "Workout"), body),
    );
  })
  .post("/:id/finish", async (c) => {
    const body = (await parseOptionalJson(c, finishWorkoutBodySchema)) ?? {
      updateTemplate: false,
    };
    return c.json(
      await workouts.finishWorkout(c.get("db"), c.get("userId"), idParam(c, "id", "Workout"), body),
    );
  })
  .delete("/:id", async (c) => {
    await workouts.deleteWorkout(c.get("db"), c.get("userId"), idParam(c, "id", "Workout"));
    return c.body(null, 204);
  });

export const templateRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await workouts.listTemplates(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, createTemplateBodySchema);
    return c.json(await workouts.createTemplate(c.get("db"), c.get("userId"), body), 201);
  })
  .patch("/:id", async (c) => {
    const body = await parseJson(c, templateBodySchema.partial());
    return c.json(
      await workouts.updateTemplate(
        c.get("db"),
        c.get("userId"),
        idParam(c, "id", "Template"),
        body,
      ),
    );
  })
  .delete("/:id", async (c) => {
    await workouts.deleteTemplate(c.get("db"), c.get("userId"), idParam(c, "id", "Template"));
    return c.body(null, 204);
  });

export const exerciseRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await workouts.listExercises(c.get("db"), c.get("userId"))))
  .post("/", async (c) => {
    const body = await parseJson(c, exerciseBodySchema);
    return c.json(await workouts.createExercise(c.get("db"), c.get("userId"), body), 201);
  })
  .get("/:id", async (c) =>
    c.json(
      await workouts.getExercise(c.get("db"), c.get("userId"), exerciseParam(c.req.param("id"))),
    ),
  )
  .patch("/:id", async (c) => {
    const body = await parseJson(c, exerciseBodySchema.partial());
    return c.json(
      await workouts.updateExercise(
        c.get("db"),
        c.get("userId"),
        exerciseParam(c.req.param("id")),
        body,
      ),
    );
  })
  .delete("/:id", async (c) => {
    await workouts.archiveExercise(c.get("db"), c.get("userId"), exerciseParam(c.req.param("id")));
    return c.body(null, 204);
  });
