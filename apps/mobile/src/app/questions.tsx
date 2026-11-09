import {
  ALL_DAYS,
  MAX_CUSTOM_PROMPT_QUESTION,
  MAX_CUSTOM_PROMPTS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  type CustomPromptDto,
} from "@rlo/shared";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import {
  useCreateCustomPrompt,
  useCustomPrompts,
  useDeleteCustomPrompt,
  useUpdateCustomPrompt,
} from "@/api/customPrompts";
import { Chip, FormRow } from "@/components/controls";
import { FeatureGate } from "@/components/FeatureGate";
import { Body, Button, Card, ErrorNote, Field, Loading, Muted, Screen } from "@/components/ui";
import { scheduleLabel } from "@/lib/habits";
import { colors, space } from "@/lib/theme";

/** The player's own questions, asked in the day log on the days they pick (DESIGN.md §7.11). */
function QuestionsScreen() {
  const prompts = useCustomPrompts();
  const remove = useDeleteCustomPrompt();
  /** "new", a question id being edited, or null. */
  const [editing, setEditing] = useState<string | null>(null);

  if (prompts.isPending) return <Loading />;
  if (prompts.isError) {
    return (
      <Screen>
        <ErrorNote error={prompts.error} onRetry={() => void prompts.refetch()} />
      </Screen>
    );
  }
  const full = prompts.data.length >= MAX_CUSTOM_PROMPTS;
  const confirmDelete = (p: CustomPromptDto) =>
    Alert.alert("Delete this question?", "Answers you already gave are kept.", [
      { text: "Keep", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(p.id) },
    ]);

  return (
    <Screen
      title="Your questions"
      subtitle="Asked in the day log on the days you pick, next to the scout's. Your answers go into that day's recap."
    >
      {editing === "new" ? (
        <QuestionEditor onDone={() => setEditing(null)} />
      ) : (
        !full && (
          <Button
            title="+ New question"
            disabled={editing !== null}
            onPress={() => setEditing("new")}
          />
        )
      )}
      {prompts.data.length === 0 && editing === null && (
        <Card>
          <Muted style={{ textAlign: "center" }}>
            Something like &quot;What&apos;s one thing you&apos;re grateful for?&quot; every Sunday,
            or &quot;What did you learn today?&quot; on weekdays.
          </Muted>
        </Card>
      )}
      {prompts.data.map((p) =>
        editing === p.id ? (
          <QuestionEditor key={p.id} prompt={p} onDone={() => setEditing(null)} />
        ) : (
          <Pressable
            key={p.id}
            disabled={editing !== null}
            onPress={() => setEditing(p.id)}
            onLongPress={() => confirmDelete(p)}
          >
            <Card style={{ gap: 2 }}>
              <Body style={{ fontWeight: "600" }}>{p.question}</Body>
              <Muted style={{ fontSize: 13 }}>{scheduleLabel(p.days)}</Muted>
            </Card>
          </Pressable>
        ),
      )}
      {prompts.data.length > 0 && (
        <Muted style={{ fontSize: 13 }}>
          Tap a question to edit it; hold it to delete.
          {full && ` That's the most you can have (${MAX_CUSTOM_PROMPTS}).`}
        </Muted>
      )}
      <ErrorNote error={remove.error} />
    </Screen>
  );
}

function QuestionEditor({ prompt, onDone }: { prompt?: CustomPromptDto; onDone: () => void }) {
  const [question, setQuestion] = useState(prompt?.question ?? "");
  const [days, setDays] = useState<number[]>(prompt?.days ?? ALL_DAYS);
  const create = useCreateCustomPrompt();
  const update = useUpdateCustomPrompt();
  const saving = create.isPending || update.isPending;

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b),
    );
  const submit = () => {
    const body = { question: question.trim(), days };
    if (prompt) update.mutate({ id: prompt.id, ...body }, { onSuccess: onDone });
    else create.mutate(body, { onSuccess: onDone });
  };

  return (
    <Card style={styles.editor}>
      <FormRow label="Question">
        <Field
          value={question}
          maxLength={MAX_CUSTOM_PROMPT_QUESTION}
          autoFocus
          placeholder="e.g. What's one thing you're grateful for?"
          onChangeText={setQuestion}
        />
      </FormRow>
      <FormRow label="Asked on">
        <View style={styles.wrap}>
          {WEEKDAY_LETTERS.map((letter, d) => (
            <View key={d} accessible accessibilityLabel={WEEKDAY_NAMES[d]}>
              <Chip round label={letter} selected={days.includes(d)} onPress={() => toggleDay(d)} />
            </View>
          ))}
        </View>
      </FormRow>
      <ErrorNote error={create.error ?? update.error} />
      <Button
        title={saving ? "Saving…" : prompt ? "Save question" : "Add question"}
        disabled={!question.trim() || days.length === 0 || saving}
        onPress={submit}
      />
      <Button title="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

const styles = StyleSheet.create({
  editor: { gap: space.md, borderColor: colors.neonDim },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});

export default function GatedQuestionsScreen() {
  return (
    <FeatureGate feature="guidedPrompts">
      <QuestionsScreen />
    </FeatureGate>
  );
}
