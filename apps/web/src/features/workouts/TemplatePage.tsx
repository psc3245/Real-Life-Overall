import type { WorkoutTemplateDto } from "@rlo/shared";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  useCreateTemplate,
  useExercises,
  useTemplates,
  useUpdateTemplate,
} from "../../api/workouts";
import { Button } from "../../components/Button";
import { compactFieldClass } from "../../components/form";
import { ErrorNote } from "../onboarding/ErrorNote";
import { WorkoutEditor } from "./WorkoutEditor";
import { useUnits } from "./WorkoutsNav";

/** Creates (/workouts/templates/new) or edits a template. */
export function TemplatePage() {
  const { id } = useParams();
  const templates = useTemplates();
  if (!id || id === "new") return <TemplateForm />;
  if (templates.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (templates.isError) return <ErrorNote error={templates.error} />;
  const template = templates.data.find((t) => t.id === id);
  if (!template) return <p className="pt-10 text-court-500">Template not found.</p>;
  return <TemplateForm template={template} />;
}

function TemplateForm({ template }: { template?: WorkoutTemplateDto }) {
  const units = useUnits();
  const library = useExercises();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const navigate = useNavigate();
  const [name, setName] = useState(template?.name ?? "");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [exercises, setExercises] = useState(template?.exercises ?? []);
  const saving = create.isPending || update.isPending;

  return (
    <form
      aria-label={template ? "Edit template" : "New template"}
      className="space-y-6 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const body = { name: name.trim(), notes, exercises };
        const done = { onSuccess: () => navigate("/workouts") };
        if (template) update.mutate({ id: template.id, ...body }, done);
        else create.mutate(body, done);
      }}
    >
      <div>
        <Link to="/workouts" className="text-sm text-court-300 hover:text-neon">
          ← Workouts
        </Link>
        <p className="text-sm uppercase tracking-[0.3em] text-neon">
          {template ? "Edit template" : "New template"}
        </p>
        <input
          aria-label="Template name"
          value={name}
          required
          autoFocus={!template}
          maxLength={80}
          placeholder="Push Day"
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-transparent font-display text-4xl font-bold uppercase outline-none placeholder:text-court-700 focus:text-neon"
        />
      </div>
      <textarea
        aria-label="Template notes"
        value={notes}
        rows={2}
        maxLength={2000}
        placeholder="Notes (warm-up routine, rest times, focus…)"
        onChange={(e) => setNotes(e.target.value)}
        className={`${compactFieldClass} w-full`}
      />
      <p className="text-sm text-court-500">
        Sets here are targets. Starting the template fills them in, ready to check off.
      </p>
      <WorkoutEditor
        exercises={exercises}
        library={library.data ?? []}
        units={units}
        mode="plan"
        onChange={setExercises}
      />
      <ErrorNote error={create.error ?? update.error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate("/workouts")}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>
    </form>
  );
}
