import { router } from "expo-router";
import { KeyboardAvoidingView } from "react-native";
import { useRatings } from "@/api/ratings";
import { useSaveSeasonTree, useSeasonSetup } from "@/api/seasons";
import { TreeBuilder } from "@/components/onboarding/TreeBuilder";
import { Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { nodesToDraft } from "@/lib/draft";

/** Reshape the tree while a new season's setup window is open. */
export default function SeasonSetupScreen() {
  const setup = useSeasonSetup();
  const ratings = useRatings();
  const save = useSaveSeasonTree();

  if (setup.isPending || ratings.isPending) return <Loading />;
  if (setup.isError) {
    return (
      <Screen>
        <ErrorNote error={setup.error} onRetry={() => void setup.refetch()} />
      </Screen>
    );
  }
  if (!setup.data.editable || !ratings.data) {
    return (
      <Screen title="Season setup">
        <Card>
          <Muted>
            Season setup is closed. Your categories can change at the start of each new season.
          </Muted>
        </Card>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={100}>
      <Screen eyebrow={`Season ${setup.data.label}`} title="Season setup">
        <Muted>
          Your ratings carried over{setup.data.previous ? ` from ${setup.data.previous.label}` : ""}
          . Rename, add, move or remove categories and attributes until {setup.data.setupEndsOn}.
          New attributes get starting ratings from the scout; removed ones keep their history.
        </Muted>
        <TreeBuilder
          initial={nodesToDraft(ratings.data.nodes)}
          saving={save.isPending}
          saveError={save.error}
          saveLabel="Save season"
          onSave={(draft) => save.mutate(draft, { onSuccess: () => router.replace("/ratings") })}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
