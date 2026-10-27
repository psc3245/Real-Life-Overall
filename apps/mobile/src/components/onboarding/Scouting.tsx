import {
  isRequired,
  leafIds,
  MAX_SHORT_TEXT_ANSWER,
  unansweredRequired,
  validateAnswer,
  type AnswerValue,
  type Answers,
  type OnboardingStateDto,
  type QuestionDto,
} from "@rlo/shared";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  useFinishFollowup,
  useFollowup,
  useGenerateQuestionnaire,
  useSaveAnswers,
  useSubmitQuestionnaire,
} from "@/api/onboarding";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { Chip, NumberField } from "../controls";
import { Body, Button, Card, ErrorNote, Field, Label, Muted } from "../ui";
import { Chat } from "./Chat";

const AUTOSAVE_DELAY_MS = 700;

/** Step 4: questions, then follow-up chat, then a read-only recap. */
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
  if (state.questionnaire) return <QuestionnaireForm state={state} />;
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
    <Card style={{ gap: space.md }}>
      <Text style={styles.big}>{talk.scouting}</Text>
      <Muted>
        You&apos;ll get questions written for your {attributes} attributes, about what you&apos;ve
        actually been doing lately. Your answers set your starting ratings. It takes about 5–10
        minutes, and your answers save as you go.
      </Muted>
      <Muted style={{ color: colors.court500, fontSize: 13 }}>
        Generating the questions locks your build and weights for Season {state.season.label}.
      </Muted>
      <Button
        title={generate.isPending ? "Writing your questions…" : talk.startScouting}
        disabled={generate.isPending}
        onPress={() => generate.mutate()}
      />
      <Button
        title="← Adjust build or weights"
        variant="ghost"
        disabled={generate.isPending}
        onPress={onEditBuild}
      />
      {generate.isPending && <Muted>This usually takes 10–30 seconds.</Muted>}
      <ErrorNote error={generate.error} />
    </Card>
  );
}

/** Groups questions under the top-level category of the first attribute they inform. */
function groupByCategory(state: OnboardingStateDto, questions: QuestionDto[]) {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  const categoryOf = (nodeId: string) => {
    let node = byId.get(nodeId);
    while (node && node.depth > 1) node = node.parentId ? byId.get(node.parentId) : undefined;
    return node;
  };
  const groups = new Map<string, { name: string; questions: QuestionDto[] }>();
  for (const q of questions) {
    const category = categoryOf(q.nodeIds[0]!);
    const key = category?.id ?? "other";
    if (!groups.has(key)) groups.set(key, { name: category?.name ?? "Other", questions: [] });
    groups.get(key)!.questions.push(q);
  }
  return [...groups.values()];
}

function QuestionnaireForm({ state }: { state: OnboardingStateDto }) {
  const questions = state.questionnaire!;
  const [answers, setAnswers] = useState<Answers>(state.answers);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const pending = useRef<Record<string, AnswerValue | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = useSaveAnswers();
  const submit = useSubmitQuestionnaire();
  const [dirty, setDirty] = useState(false);

  const flush = async () => {
    clearTimeout(timer.current);
    const batch = pending.current;
    if (!Object.keys(batch).length) return;
    pending.current = {};
    try {
      await save.mutateAsync(batch);
      if (!Object.keys(pending.current).length) setDirty(false);
    } catch (error) {
      pending.current = { ...batch, ...pending.current }; // retry with the next change
      throw error;
    }
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = (question: QuestionDto, value: AnswerValue | null) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === null) delete next[question.id];
      else next[question.id] = value;
      return next;
    });
    const problem = value === null ? null : validateAnswer(question, value);
    setInvalid((prev) => {
      const next = { ...prev };
      if (problem) next[question.id] = problem;
      else delete next[question.id];
      return next;
    });
    if (problem) return; // never autosave an invalid value
    pending.current[question.id] = value;
    setDirty(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush().catch(() => {}), AUTOSAVE_DELAY_MS);
  };

  const required = questions.filter(isRequired);
  const remaining = unansweredRequired(questions, answers).length;
  const answered = required.length - remaining;
  const canSubmit = remaining === 0 && Object.keys(invalid).length === 0;

  const onSubmit = async () => {
    try {
      await flush();
      submit.mutate();
    } catch {
      // The save error is shown below.
    }
  };

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <View style={styles.progressHead}>
          <Text style={{ color: colors.court300 }}>
            <Text style={styles.count}>{answered}</Text> / {required.length} answered
          </Text>
          <Label style={{ color: colors.court500 }}>
            {save.isError ? "Not saved" : dirty || save.isPending ? "Saving…" : "Saved"}
          </Label>
        </View>
        <View style={styles.meter}>
          <View
            style={[
              styles.meterFill,
              { width: `${(answered / Math.max(1, required.length)) * 100}%` },
            ]}
          />
        </View>
      </View>

      {groupByCategory(state, questions).map((group) => (
        <View key={group.name} style={{ gap: space.md }}>
          <Text style={styles.group}>{group.name}</Text>
          {group.questions.map((q) => (
            <Card key={q.id} style={{ gap: space.md }}>
              <QuestionField
                question={q}
                value={answers[q.id]}
                onChange={(value) => onChange(q, value)}
              />
              {invalid[q.id] && <Text style={{ color: colors.flare }}>{invalid[q.id]}</Text>}
            </Card>
          ))}
        </View>
      ))}

      <Muted>
        {remaining > 0 ? `${remaining} left to answer` : "All set. Text answers are optional."}
      </Muted>
      <ErrorNote error={submit.error ?? save.error} />
      <Button
        title={submit.isPending ? "Submitting…" : "Submit answers"}
        disabled={!canSubmit || submit.isPending}
        onPress={() => void onSubmit()}
      />
    </View>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: QuestionDto;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | null) => void;
}) {
  return (
    <View style={{ gap: space.md }}>
      <Body style={{ fontWeight: "600" }}>
        {question.prompt}
        {question.type === "short_text" && (
          <Text style={{ color: colors.court500, fontSize: 12 }}> OPTIONAL</Text>
        )}
      </Body>
      <Input question={question} value={value} onChange={onChange} />
    </View>
  );
}

function Input({
  question,
  value,
  onChange,
}: {
  question: QuestionDto;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue | null) => void;
}) {
  switch (question.type) {
    case "single_choice":
      return (
        <View style={styles.wrap} accessibilityRole="radiogroup">
          {question.options.map((option) => (
            <Chip
              key={option}
              label={option}
              selected={value === option}
              onPress={() => onChange(option)}
            />
          ))}
        </View>
      );

    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      const toggle = (option: string) =>
        onChange(
          selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option],
        );
      return (
        <View style={{ gap: space.sm }}>
          <View style={styles.wrap}>
            {question.options.map((option) => (
              <Chip
                key={option}
                label={option}
                selected={selected.includes(option)}
                onPress={() => toggle(option)}
              />
            ))}
          </View>
          {value === undefined && (
            <Pressable onPress={() => onChange([])} hitSlop={6}>
              <Text style={styles.none}>None of these</Text>
            </Pressable>
          )}
        </View>
      );
    }

    case "slider": {
      const min = question.min ?? 0;
      const max = question.max ?? 10;
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <View style={{ gap: space.xs }}>
          <View style={styles.scale}>
            {steps.map((n) => {
              const on = typeof value === "number" && n <= value;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: value === n }}
                  accessibilityLabel={String(n)}
                  onPress={() => onChange(n)}
                  style={[styles.scaleStep, on && styles.scaleOn]}
                >
                  <Text style={[styles.scaleText, on && { color: colors.court950 }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.scaleLabels}>
            <Muted style={{ fontSize: 12 }}>{question.minLabel ?? min}</Muted>
            <Muted style={{ fontSize: 12 }}>{question.maxLabel ?? max}</Muted>
          </View>
        </View>
      );
    }

    case "number":
      return (
        <View style={styles.numberRow}>
          <NumberField
            label={question.prompt}
            value={typeof value === "number" ? value : null}
            onChange={onChange}
            width={120}
          />
          {question.unit && <Muted>{question.unit}</Muted>}
        </View>
      );

    case "short_text":
      return (
        <Field
          multiline
          maxLength={MAX_SHORT_TEXT_ANSWER}
          value={typeof value === "string" ? value : ""}
          onChangeText={(t) => onChange(t === "" ? null : t)}
          style={{ minHeight: 70 }}
        />
      );
  }
}

function FollowupChat({ state }: { state: OnboardingStateDto }) {
  const followup = useFollowup();
  const finish = useFinishFollowup();
  const opened = useRef(false);
  const { chat } = state;

  // Open the conversation once.
  useEffect(() => {
    if (chat.length === 0 && !opened.current) {
      opened.current = true;
      followup.mutate(undefined);
    }
  }, [chat.length, followup]);

  return (
    <View style={{ gap: space.lg }}>
      <Muted>
        A few quick follow-ups on your answers. Short replies are fine, or skip ahead any time.
      </Muted>
      <Chat
        messages={chat}
        pendingReply={followup.isPending ? followup.variables : undefined}
        waiting={followup.isPending}
        disabled={chat.length === 0}
        onSend={(message, restore) => followup.mutate(message, { onError: restore })}
      />
      <ErrorNote error={followup.error} />
      {followup.isError && chat.length === 0 && (
        <Button title="Try again" variant="ghost" onPress={() => followup.mutate(undefined)} />
      )}
      <Button
        title="Skip to my ratings →"
        variant="ghost"
        disabled={finish.isPending || followup.isPending}
        onPress={() => finish.mutate()}
      />
      <ErrorNote error={finish.error} />
    </View>
  );
}

function formatAnswer(question: QuestionDto, value: AnswerValue | undefined): string {
  if (value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None of these";
  if (typeof value === "number") return `${value}${question.unit ? ` ${question.unit}` : ""}`;
  return value;
}

/** Read-only view of submitted answers and the follow-up chat. */
function ScoutingRecap({ state }: { state: OnboardingStateDto }) {
  return (
    <View style={{ gap: space.lg }}>
      <Label>Your answers</Label>
      <Card style={{ padding: 0 }}>
        {(state.questionnaire ?? []).map((q, i) => (
          <View key={q.id} style={[styles.answer, i > 0 && styles.border]}>
            <Muted>{q.prompt}</Muted>
            <Body style={{ fontWeight: "600" }}>{formatAnswer(q, state.answers[q.id])}</Body>
          </View>
        ))}
      </Card>
      {state.chat.length > 0 && (
        <>
          <Label>Follow-up</Label>
          <Card style={{ gap: space.sm }}>
            {state.chat.map((m, i) => (
              <Text
                key={i}
                style={{ color: m.role === "user" ? colors.court100 : colors.court300 }}
              >
                <Text style={styles.speaker}>{m.role === "user" ? "YOU  " : "SCOUT  "}</Text>
                {m.content}
              </Text>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  big: {
    color: colors.neon,
    fontFamily: fonts.heavy,
    fontSize: 28,
    textTransform: "uppercase",
  },
  progressHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  count: { color: colors.court100, fontFamily: fonts.heavy, fontSize: 24 },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.court700, overflow: "hidden" },
  meterFill: { height: "100%", backgroundColor: colors.neon, borderRadius: 3 },
  group: {
    color: colors.neon,
    fontFamily: fonts.display,
    fontSize: 22,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  none: { color: colors.court500, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  scale: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  scaleStep: {
    minWidth: 28,
    height: 34,
    flexGrow: 1,
    borderRadius: 6,
    backgroundColor: colors.court800,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleOn: { backgroundColor: colors.neon },
  scaleText: { color: colors.court100, fontFamily: fonts.display, fontSize: 15 },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between" },
  numberRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  answer: { gap: space.xs, padding: space.lg },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  speaker: { color: colors.court500, fontSize: 11, letterSpacing: 1 },
});
