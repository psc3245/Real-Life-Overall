import { Button } from "../../components/Button";

export function ScoutingPlaceholder({ onEditBuild }: { onEditBuild: () => void }) {
  return (
    <div className="rounded-xl border border-court-700 bg-court-900/70 p-8 text-center">
      <p className="font-display text-3xl uppercase tracking-wider text-neon">Build locked in</p>
      <p className="mx-auto mt-3 max-w-md text-court-300">
        Next up is the scouting questionnaire: questions written for your categories that set your
        starting ratings. It arrives in the next update.
      </p>
      <Button className="mt-6" onClick={onEditBuild}>
        ← Adjust build or weights
      </Button>
    </div>
  );
}
