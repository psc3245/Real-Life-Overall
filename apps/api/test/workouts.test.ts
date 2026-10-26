import {
  emptySet,
  type BodyDto,
  type DayDto,
  type ExerciseDetailDto,
  type ExerciseDto,
  type MeDto,
  type ObjectiveDto,
  type WorkoutDto,
  type WorkoutHistoryDto,
  type WorkoutSetDto,
  type WorkoutTemplateDto,
} from "@rlo/shared";
import { describe, expect, it } from "vitest";
import { createRatedApp, json } from "./flows";
import { createTestApp, jsonResult } from "./helpers";

const body = async <T>(res: Response) => (await res.json()) as T;
const set = (over: Partial<WorkoutSetDto>): WorkoutSetDto => ({ ...emptySet(), ...over });

async function setup() {
  const t = await createTestApp();
  const start = async (input: Record<string, unknown> = {}) =>
    body<WorkoutDto>(await t.request("/workouts", { method: "POST", ...json(input) }));
  const save = async (id: string, input: Record<string, unknown>) =>
    t.request(`/workouts/${id}`, { method: "PUT", ...json(input) });
  const finish = async (id: string, input: Record<string, unknown> = {}) =>
    t.request(`/workouts/${id}/finish`, { method: "POST", ...json(input) });
  return { ...t, start, save, finish };
}

const bench = (sets: Partial<WorkoutSetDto>[]) => ({
  exerciseId: "bench-press-barbell",
  sets: sets.map(set),
});

describe("workouts", () => {
  it("logs a workout: start, autosave, finish drops unchecked sets", async () => {
    const { request, start, save, finish } = await setup();
    const w = await start();
    expect(w).toMatchObject({
      endedAt: null,
      exercises: [],
      name: expect.stringMatching(/Workout$/),
    });
    expect((await body<WorkoutDto | null>(await request("/workouts/active")))!.id).toBe(w.id);

    // Only one workout in progress.
    expect((await request("/workouts", { method: "POST" })).status).toBe(409);

    const saved = await body<WorkoutDto>(
      await save(w.id, {
        name: "Push day",
        exercises: [
          bench([
            { kind: "warmup", weightKg: 40, reps: 10, done: true },
            { weightKg: 80, reps: 5, done: true, durationS: 99 },
            { weightKg: 80, reps: 5 },
          ]),
          { exerciseId: "plank", sets: [set({ durationS: 60 })] },
        ],
      }),
    );
    // Fields the tracking kind doesn't record are dropped.
    expect(saved.exercises[0]!.sets[1]!.durationS).toBeNull();
    expect(saved.summary).toMatchObject({ volumeKg: 800, doneSets: 2 });

    const done = await body<WorkoutDto>(await finish(w.id));
    expect(done.endedAt).not.toBeNull();
    expect(done.exercises).toHaveLength(1); // the plank had no checked sets
    expect(done.exercises[0]!.sets).toHaveLength(2);
    expect(await body<WorkoutDto | null>(await request("/workouts/active"))).toBeNull();

    const history = await body<WorkoutHistoryDto>(await request("/workouts"));
    expect(history.workouts.map((x) => x.name)).toEqual(["Push day"]);
  });

  it("needs a checked set to finish, and rejects unknown exercises", async () => {
    const { start, save, finish } = await setup();
    const w = await start();
    expect((await finish(w.id)).status).toBe(400);
    expect((await save(w.id, { exercises: [{ exerciseId: "moon-jump", sets: [] }] })).status).toBe(
      400,
    );
  });

  it("shows previous sets and flags personal records", async () => {
    const { start, save, finish } = await setup();
    const first = await start();
    await save(first.id, { exercises: [bench([{ weightKg: 80, reps: 5, done: true }])] });
    const firstDone = await body<WorkoutDto>(await finish(first.id));
    expect(firstDone.summary.prs).toEqual([]); // nothing to beat yet

    const second = await start();
    const withBench = await body<WorkoutDto>(
      await save(second.id, { exercises: [bench([{ weightKg: 85, reps: 5, done: true }])] }),
    );
    expect(withBench.previous["bench-press-barbell"]![0]).toMatchObject({ weightKg: 80, reps: 5 });
    const done = await body<WorkoutDto>(await finish(second.id));
    expect(done.summary.prs).toEqual([
      {
        exerciseId: "bench-press-barbell",
        label: expect.stringContaining("heaviest weight"),
      },
    ]);
  });

  it("starts from a template and can update it on finish", async () => {
    const { request, start, save, finish } = await setup();
    const template = await body<WorkoutTemplateDto>(
      await request("/workout-templates", {
        method: "POST",
        ...json({
          name: "Legs",
          exercises: [
            { exerciseId: "squat-barbell", sets: [set({ weightKg: 100, reps: 5, done: true })] },
          ],
        }),
      }),
    );
    expect(template.exercises[0]!.sets[0]!.done).toBe(false);

    const w = await start({ templateId: template.id });
    expect(w).toMatchObject({ name: "Legs", templateId: template.id });
    expect(w.exercises[0]!.sets[0]).toMatchObject({ weightKg: 100, done: false });
    await save(w.id, {
      exercises: [
        { exerciseId: "squat-barbell", sets: [set({ weightKg: 105, reps: 5, done: true })] },
      ],
    });
    await finish(w.id, { updateTemplate: true });

    const [updated] = await body<WorkoutTemplateDto[]>(await request("/workout-templates"));
    expect(updated!.exercises[0]!.sets[0]).toMatchObject({ weightKg: 105, done: false });
    expect(updated!.lastUsedAt).not.toBeNull();

    // Renaming keeps the exercises.
    const renamed = await body<WorkoutTemplateDto>(
      await request(`/workout-templates/${template.id}`, {
        method: "PATCH",
        ...json({ name: "Leg Day" }),
      }),
    );
    expect(renamed).toMatchObject({ name: "Leg Day" });
    expect(renamed.exercises).toHaveLength(1);

    // Templates aren't capped.
    for (let i = 0; i < 5; i++) {
      await request("/workout-templates", { method: "POST", ...json({ name: `T${i}` }) });
    }
    expect(await body<WorkoutTemplateDto[]>(await request("/workout-templates"))).toHaveLength(6);

    const fromWorkout = await request("/workout-templates", {
      method: "POST",
      ...json({ fromWorkoutId: w.id, name: "Legs v2" }),
    });
    expect(fromWorkout.status).toBe(201);
  });

  it("supports custom exercises and per-exercise records", async () => {
    const { request, start, save, finish } = await setup();
    const custom = await body<ExerciseDto>(
      await request("/exercises", {
        method: "POST",
        ...json({ name: "Floaters", category: "sport", tracking: "makes_attempts" }),
      }),
    );
    expect(custom).toMatchObject({ custom: true, tracking: "makes_attempts" });
    const dupe = await request("/exercises", {
      method: "POST",
      ...json({ name: "free throws", category: "sport", tracking: "makes_attempts" }),
    });
    expect(dupe.status).toBe(409);

    const w = await start();
    await save(w.id, {
      exercises: [
        {
          exerciseId: custom.id,
          sets: [
            set({ reps: 7, attempts: 10, done: true }),
            set({ reps: 9, attempts: 10, done: true }),
          ],
        },
      ],
    });
    await finish(w.id);
    const detail = await body<ExerciseDetailDto>(await request(`/exercises/${custom.id}`));
    expect(detail.records).toMatchObject({ bestPct: 90, mostReps: 9 });
    expect(detail.history).toHaveLength(1);
    expect(detail.exercise.timesDone).toBe(1);

    // Built-ins can't be edited; custom ones with history keep their tracking.
    expect(
      (await request("/exercises/plank", { method: "PATCH", ...json({ name: "x" }) })).status,
    ).toBe(400);
    expect(
      (
        await request(`/exercises/${custom.id}`, {
          method: "PATCH",
          ...json({ tracking: "reps" }),
        })
      ).status,
    ).toBe(409);
    expect((await request(`/exercises/${custom.id}`, { method: "DELETE" })).status).toBe(204);
    const library = await body<ExerciseDto[]>(await request("/exercises"));
    expect(library.some((e) => e.id === custom.id)).toBe(false);
    expect(library.some((e) => e.id === "free-throws")).toBe(true);
  });

  it("keeps workouts private to their owner", async () => {
    const { start } = await setup();
    const w = await start();
    const other = await createTestApp();
    const res = await other.request(`/workouts/${w.id}`, { user: "someone-else" });
    expect(res.status).toBe(404);
  });

  it("edits a finished workout's day and duration", async () => {
    const { request, start, save, finish } = await setup();
    const w = await start();
    expect((await save(w.id, { durationS: 600 })).status).toBe(400); // not finished yet
    await save(w.id, { exercises: [bench([{ weightKg: 60, reps: 8, done: true }])] });
    await finish(w.id);
    const day = (await body<DayDto>(await request("/days/today"))).today;
    const yesterday = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const moved = await body<WorkoutDto>(
      await save(w.id, { localDate: yesterday, durationS: 3000 }),
    );
    expect(moved).toMatchObject({ localDate: yesterday, summary: { durationS: 3000 } });
    expect((await body<DayDto>(await request(`/days/${yesterday}`))).workouts).toHaveLength(1);
    expect((await body<DayDto>(await request("/days/today"))).workouts).toHaveLength(0);
  });
});

describe("workouts in the day log, goals and recap", () => {
  it("lists the day's workouts, counts them for goals and describes them to the recap", async () => {
    const t = await createRatedApp([
      jsonResult({ changes: [], narrative: "Trained.", flags: [], nextPrompts: [] }),
    ]);
    const today = (await body<DayDto>(await t.request("/days/today"))).today;
    const goal = await body<ObjectiveDto>(
      await t.request("/objectives", {
        method: "POST",
        ...json({ name: "Gym 3x", target: 3, source: "workouts", endsOn: today }),
      }),
    );
    expect(goal.unit).toBe("workouts");

    const w = await body<WorkoutDto>(await t.request("/workouts", { method: "POST" }));
    await t.request(`/workouts/${w.id}`, {
      method: "PUT",
      ...json({ name: "Push", exercises: [bench([{ weightKg: 61.235, reps: 8, done: true }])] }),
    });
    await t.request(`/workouts/${w.id}/finish`, { method: "POST" });

    const day = await body<DayDto>(await t.request("/days/today"));
    expect(day.workouts).toEqual([
      expect.objectContaining({
        name: "Push",
        lines: ["Bench Press (Barbell): 1 set, best 135 lb × 8"],
      }),
    ]);
    expect(day.objectives[0]).toMatchObject({
      dayAmount: 1,
      objective: { progress: { current: 1 } },
    });

    // A workout alone is enough to end the day.
    expect((await t.request(`/days/${today}/recap`, { method: "POST" })).status).toBe(200);
    const prompt = JSON.stringify(t.model.doGenerateCalls.at(-1)!.prompt);
    expect(prompt).toContain("Workouts:");
    expect(prompt).toContain("Bench Press (Barbell): 1 set, best 135 lb × 8");
  });
});

describe("body tracking", () => {
  it("is off until turned on, then logs weight and height by day", async () => {
    const { request } = await createTestApp();
    const { today } = await body<DayDto>(await request("/days/today"));
    const off = await request(`/body/${today}`, { method: "PUT", ...json({ weightKg: 80 }) });
    expect(off.status).toBe(409);

    const me = await body<MeDto>(
      await request("/me", {
        method: "PATCH",
        ...json({ trackWeight: true, trackHeight: true, unitSystem: "metric" }),
      }),
    );
    expect(me).toMatchObject({ trackWeight: true, trackHeight: true, unitSystem: "metric" });

    await request(`/body/${today}`, { method: "PUT", ...json({ weightKg: 80.5, heightCm: 180 }) });
    const data = await body<BodyDto>(await request("/body"));
    expect(data.entries).toEqual([{ localDate: today, weightKg: 80.5, heightCm: 180 }]);

    const day = await body<DayDto>(await request("/days/today"));
    expect(day.body).toMatchObject({ weightKg: 80.5, heightCm: 180, trackWeight: true });

    await request(`/body/${today}`, { method: "PUT", ...json({ weightKg: null }) });
    expect((await body<BodyDto>(await request("/body"))).entries[0]!.weightKg).toBeNull();
    expect(
      (await request("/body/2999-01-01", { method: "PUT", ...json({ heightCm: 180 }) })).status,
    ).toBe(400);
  });

  it("leaves body off the day log when nothing is tracked", async () => {
    const { request } = await createTestApp();
    expect((await body<DayDto>(await request("/days/today"))).body).toBeNull();
  });
});
