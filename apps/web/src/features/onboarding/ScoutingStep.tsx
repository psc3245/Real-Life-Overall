import type { OnboardingStateDto } from "@rlo/shared";
import { leafIds } from "@rlo/shared";
import { useGenerateQuestionnaire } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";
import { FollowupChat } from "./FollowupChat";
import { QuestionnaireForm } from "./QuestionnaireForm";
import { ScoutingRecap } from "./ScoutingRecap";
import { useTalk } from "../../lib/talk";

export function ScoutingStep({
  state,
  onEditBuild,
}: {
  state: OnboardingStateDto;
  onEditBuild: () => void;
}) {
  if (state.stage === "rating" || state.stage === "complete")
    return <ScoutingRecap state={state} />;
  if (state.stage === "followup") return <FollowupChat state={state} />;
  if (state.questionnaire) return <QuestionnaireForm key="form" state={state} />;
  return <ScoutingIntro state={state} onEditBuild={onEditBuild} />;
}

function ScoutingIntro({
  state,
  onEditBuild,
}: {
  state: OnboardingStateDto;
  onEditBuild: () => void;
}) {
  const talk = useTalk();
  const generate = useGenerateQuestionnaire();
  const attributes = leafIds(state.nodes).length;

  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-8 text-center">
      <p className="font-display text-3xl uppercase tracking-wider text-neon">{talk.scouting}</p>
      <p className="mx-auto mt-3 max-w-lg text-court-300">
        You'll get questions written for your {attributes} attributes, about what you've actually
        been doing lately. Your answers set your starting ratings. It takes about 5–10 minutes, and
        your answers save as you go.
      </p>
      <p className="mx-auto mt-3 max-w-lg text-sm text-court-500">
        Generating the questions locks your build and weights for Season {state.season.label}.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={onEditBuild} disabled={generate.isPending}>
          ← Adjust build or weights
        </Button>
        <Button variant="primary" disabled={generate.isPending} onClick={() => generate.mutate()}>
          {generate.isPending ? "Writing your questions…" : talk.startScouting}
        </Button>
      </div>
      {generate.isPending && (
        <p className="mt-4 animate-pulse text-sm text-court-500">
          This usually takes 10–30 seconds.
        </p>
      )}
      <div className="mt-4 flex justify-center">
        <ErrorNote error={generate.error} />
      </div>
    </div>
  );
}
