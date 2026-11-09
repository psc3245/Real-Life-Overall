import { MAX_PROMPT_ANSWER, type DayDto } from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSavePromptAnswers } from "@/api/days";
import { colors, space } from "@/lib/theme";
import { Body, ErrorNote, Field, Label } from "./ui";

/**
 * Questions the previous day's recap asked, then the player's own scheduled ones; answers save
 * when a field loses focus.
 */
export function GuidedPrompts({ day }: { day: DayDto }) {
  const save = useSavePromptAnswers(day.date);
  const [answers, setAnswers] = useState(day.prompts.map((p) => p.answer ?? ""));

  const commit = (i: number) => {
    if ((day.prompts[i]?.answer ?? "") === answers[i]) return;
    save.mutate(answers.map((a) => a || null));
  };
  // Answers save by position across both lists.
  const indexed = day.prompts.map((p, i) => ({ p, i }));
  const scouts = indexed.filter(({ p }) => !p.promptId);
  const own = indexed.filter(({ p }) => p.promptId);

  const field = ({ p, i }: (typeof indexed)[number]) => (
    <View key={p.promptId ?? p.question} style={{ gap: space.xs }}>
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
  );

  return (
    <View style={{ gap: space.md }}>
      {scouts.length > 0 && (
        <>
          <Label>Scout&apos;s questions</Label>
          {scouts.map(field)}
        </>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Label>Your questions</Label>
        <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push("/questions")}>
          <Text style={{ color: colors.neon, fontSize: 14 }}>
            {own.length ? "Edit →" : "Write your own →"}
          </Text>
        </Pressable>
      </View>
      {own.map(field)}
      <ErrorNote error={save.error} />
    </View>
  );
}
