import { MAX_PROMPT_ANSWER, type DayDto } from "@rlo/shared";
import { useState } from "react";
import { View } from "react-native";
import { useSavePromptAnswers } from "@/api/days";
import { space } from "@/lib/theme";
import { Body, ErrorNote, Field, Label } from "./ui";

/** Questions the previous day's recap asked; answers save when a field loses focus. */
export function GuidedPrompts({ day }: { day: DayDto }) {
  const save = useSavePromptAnswers(day.date);
  const [answers, setAnswers] = useState(day.prompts.map((p) => p.answer ?? ""));
  if (day.prompts.length === 0) return null;

  const commit = (i: number) => {
    if ((day.prompts[i]?.answer ?? "") === answers[i]) return;
    save.mutate(answers.map((a) => a || null));
  };

  return (
    <View style={{ gap: space.md }}>
      <Label>Scout&apos;s questions</Label>
      {day.prompts.map((p, i) => (
        <View key={p.question} style={{ gap: space.xs }}>
          <Body>{p.question}</Body>
          <Field
            value={answers[i] ?? ""}
            maxLength={MAX_PROMPT_ANSWER}
            editable={day.editable}
            placeholder="One line is plenty"
            returnKeyType="done"
            onChangeText={(t) => setAnswers((prev) => prev.map((a, j) => (j === i ? t : a)))}
            onEndEditing={() => commit(i)}
          />
        </View>
      ))}
      <ErrorNote error={save.error} />
    </View>
  );
}
