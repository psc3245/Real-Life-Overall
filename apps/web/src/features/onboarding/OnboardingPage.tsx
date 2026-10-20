import { useEffect, useState } from "react";
import { useOnboarding, useSaveTree } from "../../api/onboarding";
import { ErrorNote } from "./ErrorNote";
import { nodesToDraft } from "./draft";
import { ScoutingPlaceholder } from "./ScoutingPlaceholder";
import { StepIndicator, type StepKey } from "./StepIndicator";
import { TreeBuilder } from "./TreeBuilder";
import { WeightsStep } from "./WeightsStep";

const STAGE_TO_STEP: Record<string, StepKey> = {
  tree: "tree",
  weights: "weights",
  questionnaire: "questionnaire",
  followup: "questionnaire",
  rating: "reveal",
  complete: "reveal",
};
const STEP_ORDER: StepKey[] = ["tree", "weights", "questionnaire", "reveal"];

export function OnboardingPage() {
  const onboarding = useOnboarding();
  const saveTree = useSaveTree();
  /** Lets the user revisit an earlier step; null follows the server's stage. */
  const [viewing, setViewing] = useState<StepKey | null>(null);
  const stage = onboarding.data?.stage;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [viewing, stage]);

  if (onboarding.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (onboarding.isError) return <ErrorNote error={onboarding.error} />;

  const state = onboarding.data;
  const reached = STAGE_TO_STEP[state.stage] ?? "tree";
  const reachable = STEP_ORDER.slice(0, STEP_ORDER.indexOf(reached) + 1);
  const step = viewing && reachable.includes(viewing) ? viewing : reached;

  return (
    <div className="space-y-8 pt-4">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-[0.3em] text-neon">Season {state.season.label}</p>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">
          Create your player
        </h1>
        <StepIndicator current={step} reachable={reachable} onSelect={setViewing} />
      </header>

      {step === "tree" && (
        <TreeBuilder
          // Remount when the saved tree changes so the draft starts from the server copy.
          key={state.nodes.map((n) => n.id).join()}
          initial={nodesToDraft(state.nodes)}
          saving={saveTree.isPending}
          saveError={saveTree.error}
          onSave={(draft) => saveTree.mutate(draft, { onSuccess: () => setViewing(null) })}
        />
      )}
      {step === "weights" && (
        <WeightsStep
          key={state.nodes.map((n) => `${n.id}:${n.weight}`).join()}
          state={state}
          onBack={() => setViewing("tree")}
          onSaved={() => setViewing(null)}
        />
      )}
      {step === "questionnaire" && <ScoutingPlaceholder onEditBuild={() => setViewing("tree")} />}
    </div>
  );
}
