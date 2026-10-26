import { Link, useNavigate } from "react-router";
import { useRatings } from "../../api/ratings";
import { useSaveSeasonTree, useSeasonSetup } from "../../api/seasons";
import { nodesToDraft } from "../onboarding/draft";
import { ErrorNote } from "../onboarding/ErrorNote";
import { TreeBuilder } from "../onboarding/TreeBuilder";
import { useTalk } from "../../lib/talk";

export function SeasonSetupPage() {
  const talk = useTalk();
  const setup = useSeasonSetup();
  const ratings = useRatings();
  const save = useSaveSeasonTree();
  const navigate = useNavigate();

  if (setup.isPending || ratings.isPending) return <p className="pt-10 text-court-500">Loading…</p>;
  if (setup.isError) return <ErrorNote error={setup.error} />;
  if (!setup.data.editable || !ratings.data) {
    return (
      <div className="pt-16 text-center">
        <p className="font-display text-3xl uppercase">Season setup is closed</p>
        <p className="mt-2 text-court-300">
          Your categories can change at the start of each new season.
        </p>
        <Link to="/ratings" className="mt-4 inline-block text-neon hover:underline">
          Back to my rating →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <header>
        <p className="text-sm uppercase tracking-[0.3em] text-neon">Season {setup.data.label}</p>
        <h1 className="font-display text-4xl font-bold uppercase md:text-5xl">Season setup</h1>
        <p className="mt-2 max-w-2xl text-court-300">
          Your ratings carried over{setup.data.previous ? ` from ${setup.data.previous.label}` : ""}
          . Rename, add, move or remove categories and attributes until {setup.data.setupEndsOn}.
          New attributes get starting ratings from {talk.scout}; removed ones keep their history.
        </p>
      </header>
      <TreeBuilder
        initial={nodesToDraft(ratings.data.nodes)}
        saving={save.isPending}
        saveError={save.error}
        saveLabel="Save season"
        onSave={(draft) => save.mutate(draft, { onSuccess: () => navigate("/ratings") })}
      />
    </div>
  );
}
