import { MIN_DISCOVERY_ANSWERS, type OnboardingStateDto } from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useDiscovery,
  useDraftTemplate,
  useOnboarding,
  useSaveTree,
  useSkipDiscovery,
} from "@/api/onboarding";
import { Chip } from "@/components/controls";
import { Chat } from "@/components/onboarding/Chat";
import { RevealStep } from "@/components/onboarding/Reveal";
import { useTalk } from "@/lib/talk";
import { ScoutingStep } from "@/components/onboarding/Scouting";
import { TreeBuilder } from "@/components/onboarding/TreeBuilder";
import { WeightsStep } from "@/components/onboarding/WeightsStep";
import { Button, Card, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { nodesToDraft } from "@/lib/draft";
import { colors, fonts, space } from "@/lib/theme";

const STEPS = [
  { key: "discover", label: "Discover" },
  { key: "tree", label: "Build" },
  { key: "weights", label: "Weights" },
  { key: "questionnaire", label: "Scouting" },
  { key: "reveal", label: "Reveal" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
const STEP_ORDER = STEPS.map((s) => s.key);

const STAGE_TO_STEP: Record<string, StepKey> = {
  discovery: "discover",
  tree: "tree",
  weights: "weights",
  questionnaire: "questionnaire",
  followup: "questionnaire",
  rating: "reveal",
  complete: "reveal",
};

/** Create your player: discover → build → weights → scouting → reveal (as on the web). */
export default function OnboardingScreen() {
  const talk = useTalk();
  const onboarding = useOnboarding();
  const saveTree = useSaveTree();
  /** Lets the player revisit an earlier step; null follows the server's stage. */
  const [viewing, setViewing] = useState<StepKey | null>(null);

  if (onboarding.isPending) return <Loading />;
  if (onboarding.isError) {
    return (
      <Screen>
        <ErrorNote error={onboarding.error} onRetry={() => void onboarding.refetch()} />
      </Screen>
    );
  }

  const state = onboarding.data;
  const reached = STAGE_TO_STEP[state.stage] ?? "tree";
  // Discovery is one-way, and once questions exist the build and weights lock too.
  const firstOpen = state.questionnaire
    ? STEP_ORDER.indexOf("questionnaire")
    : state.stage === "discovery"
      ? 0
      : STEP_ORDER.indexOf("tree");
  const reachable = STEP_ORDER.slice(firstOpen, STEP_ORDER.indexOf(reached) + 1);
  const step = viewing && reachable.includes(viewing) ? viewing : reached;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={100}>
      <Screen key={step} eyebrow={`Season ${state.season.label}`} title="Create your player">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.steps}
        >
          {STEPS.map((s, i) => (
            <Chip
              key={s.key}
              label={`${i + 1} ${s.key === "questionnaire" ? talk.scouting : s.key === "reveal" ? talk.reveal : s.label}`}
              selected={s.key === step}
              disabled={!reachable.includes(s.key) || s.key === step}
              onPress={() => setViewing(s.key)}
            />
          ))}
        </ScrollView>

        {step === "discover" && <DiscoveryStep state={state} />}
        {step === "tree" && state.templateRationale && (
          <Card style={styles.drafted}>
            <Text style={{ color: colors.court300, fontSize: 14, lineHeight: 20 }}>
              <Text style={styles.draftedLabel}>Drafted for you. </Text>
              {state.templateRationale} Rename, add or remove anything; weights come next.
            </Text>
          </Card>
        )}
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
        {step === "questionnaire" && (
          <ScoutingStep state={state} onEditBuild={() => setViewing("tree")} />
        )}
        {step === "reveal" && <RevealStep state={state} />}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const DRAFTING = [
  "Reading your conversation…",
  "Choosing your categories…",
  "Weighing what matters…",
];

/** Step 1: get to know the player, then let the scout draft their rating tree. */
function DiscoveryStep({ state }: { state: OnboardingStateDto }) {
  const talk = useTalk();
  const chat = useDiscovery();
  const draft = useDraftTemplate();
  const skip = useSkipDiscovery();
  const [line, setLine] = useState(0);
  const opened = useRef(false);
  const { messages, done } = state.discovery;
  const answers = messages.filter((m) => m.role === "user").length;
  const busy = chat.isPending || draft.isPending || skip.isPending;

  // Open the conversation once.
  useEffect(() => {
    if (messages.length === 0 && !opened.current) {
      opened.current = true;
      chat.mutate(undefined);
    }
  }, [messages.length, chat]);

  useEffect(() => {
    if (!draft.isPending) return;
    const timer = setInterval(() => setLine((l) => (l + 1) % DRAFTING.length), 3500);
    return () => clearInterval(timer);
  }, [draft.isPending]);

  return (
    <View style={{ gap: space.lg }}>
      <Muted>
        First, a short conversation so {talk.scout} understands what matters in your life. Then it
        drafts your rating tree for you to edit.
      </Muted>
      {done ? (
        <View style={{ gap: space.sm }}>
          {messages.map((m, i) => (
            <Muted key={i} style={m.role === "user" ? { color: colors.court100 } : undefined}>
              {m.content}
            </Muted>
          ))}
        </View>
      ) : (
        <Chat
          messages={messages}
          pendingReply={chat.isPending ? chat.variables : undefined}
          waiting={chat.isPending}
          disabled={messages.length === 0 || draft.isPending}
          onSend={(message, restore) => chat.mutate(message, { onError: restore })}
        />
      )}
      <ErrorNote error={chat.error} />
      {chat.isError && messages.length === 0 && (
        <Button title="Try again" variant="ghost" onPress={() => chat.mutate(undefined)} />
      )}

      {answers < MIN_DISCOVERY_ANSWERS && (
        <Muted style={{ color: colors.court500 }}>
          Answer {MIN_DISCOVERY_ANSWERS - answers} more to draft your tree.
        </Muted>
      )}
      <Button
        title={draft.isPending ? DRAFTING[line]! : "Build my template"}
        variant={done ? "primary" : "ghost"}
        disabled={answers < MIN_DISCOVERY_ANSWERS || busy}
        onPress={() => draft.mutate()}
      />
      {draft.isPending && <Muted>This can take up to a minute.</Muted>}
      <Button
        title="Skip, I'll build it myself"
        variant="ghost"
        disabled={busy}
        onPress={() => skip.mutate()}
      />
      <ErrorNote error={draft.error ?? skip.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: space.sm },
  drafted: { borderColor: "rgba(60,242,200,0.3)", backgroundColor: "rgba(60,242,200,0.05)" },
  draftedLabel: {
    color: colors.neon,
    fontFamily: fonts.display,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
