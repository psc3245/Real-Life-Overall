import type { OnboardingStateDto } from "@rlo/shared";
import { leafIds } from "@rlo/shared";
import { useGenerateQuestionnaire } from "../../api/onboarding";
import { Button } from "../../components/Button";
import { ErrorNote } from "./ErrorNote";
import { FollowupChat } from "./FollowupChat";
import { QuestionnaireForm } from "./QuestionnaireForm";
import { ScoutingRecap } from "./ScoutingRecap";
import { useTalk } from "../../lib/talk";
import { useAccount } from "../../api/account";
import { PremiumBadge } from "../../components/Premium";

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
  const { premium } = useAccount();
  const attributes = leafIds(state.nodes).length;
  const writing = generate.isPending && generate.variables === "scout";

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-display text-3xl uppercase tracking-wider text-neon">{talk.scouting}</p>
        <p className="mx-auto mt-2 max-w-lg text-court-300">
          Your answers about what you've actually been doing lately set your starting ratings for
          your {attributes} attributes. Answers save as you go.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-court-500">
          Starting locks your build and weights for Season {state.season.label}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <MethodCard
          title={talk.Scout}
          badge={premium ? "AI" : undefined}
          detail="Questions written for your exact build, a short follow-up chat, and ratings with the scout's reasoning. 5–10 minutes."
          action={writing ? "Writing your questions…" : talk.startScouting}
          locked={!premium}
          disabled={generate.isPending}
          primary={premium}
          onStart={() => generate.mutate("scout")}
        />
        <MethodCard
          title="The Combine"
          badge="No AI"
          detail="Standard questions for every attribute, scored the same way for everyone. About 3 minutes, and ratings right away."
          action={
            generate.isPending && generate.variables === "combine"
              ? "Setting up…"
              : "Run the Combine"
          }
          disabled={generate.isPending}
          primary={!premium}
          onStart={() => generate.mutate("combine")}
        />
      </div>
      {writing && (
        <p className="animate-pulse text-center text-sm text-court-500">
          This usually takes 10–30 seconds.
        </p>
      )}
      <div className="flex justify-center">
        <ErrorNote error={generate.error} />
      </div>
      <div className="flex justify-center">
        <Button variant="ghost" onClick={onEditBuild} disabled={generate.isPending}>
          ← Adjust build or weights
        </Button>
      </div>
    </div>
  );
}

function MethodCard({
  title,
  badge,
  detail,
  action,
  locked = false,
  disabled,
  primary,
  onStart,
}: {
  title: string;
  badge?: string;
  detail: string;
  action: string;
  locked?: boolean;
  disabled: boolean;
  primary: boolean;
  onStart: () => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-5 ${primary ? "border-neon/60 bg-neon/5" : "border-court-700 bg-court-900/70"}`}
    >
      <p className="font-display text-2xl uppercase tracking-wider">
        {title}
        {locked ? (
          <PremiumBadge className="ml-2" />
        ) : (
          badge && (
            <span className="ml-2 rounded bg-court-800 px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wider text-court-300">
              {badge}
            </span>
          )
        )}
      </p>
      <p className="flex-1 text-sm text-court-300">{detail}</p>
      <Button
        variant={primary ? "primary" : "secondary"}
        disabled={disabled || locked}
        onClick={onStart}
      >
        {action}
      </Button>
    </div>
  );
}
