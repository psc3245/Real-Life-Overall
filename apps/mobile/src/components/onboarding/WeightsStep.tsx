import {
  IMPORTANCE_MAX,
  IMPORTANCE_MIN,
  normalizeWeights,
  type OnboardingStateDto,
  type RatingNodeDto,
} from "@rlo/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSaveWeights, useSuggestWeights } from "@/api/onboarding";
import { colors, fonts, space } from "@/lib/theme";
import { Body, Button, Card, ErrorNote, Field, Label, Muted } from "../ui";

const clampImportance = (w: number) =>
  Math.min(IMPORTANCE_MAX, Math.max(IMPORTANCE_MIN, Math.round(w)));

const LEVELS = Array.from(
  { length: IMPORTANCE_MAX - IMPORTANCE_MIN + 1 },
  (_, i) => IMPORTANCE_MIN + i,
);

/** How much each category and attribute counts toward its parent (AI-suggested, user-set). */
export function WeightsStep({
  state,
  onBack,
  onSaved,
}: {
  state: OnboardingStateDto;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [priorities, setPriorities] = useState(state.priorities ?? "");
  const [rationale, setRationale] = useState(state.weightRationale);
  const [weights, setWeights] = useState(
    () =>
      new Map(state.nodes.filter((n) => n.parentId).map((n) => [n.id, clampImportance(n.weight)])),
  );
  const suggest = useSuggestWeights();
  const save = useSaveWeights();

  const parents = state.nodes.filter((p) => state.nodes.some((n) => n.parentId === p.id));
  const childrenOf = (id: string) => state.nodes.filter((n) => n.parentId === id);

  const runSuggest = () =>
    suggest.mutate(priorities, {
      onSuccess: (s) => {
        setWeights(new Map(s.weights.map((w) => [w.nodeId, w.weight])));
        setRationale(s.rationale);
      },
    });

  return (
    <View style={{ gap: space.xl }}>
      <Card style={{ gap: space.md }}>
        <Text style={styles.title}>What matters most to you right now?</Text>
        <Muted>
          The AI proposes how much each category and attribute counts toward its parent. You get the
          final say.
        </Muted>
        <Field
          value={priorities}
          onChangeText={setPriorities}
          maxLength={1000}
          multiline
          placeholder="e.g. Getting promoted this year matters most, then my health. Social life is fine as is."
          style={{ minHeight: 90 }}
        />
        <Button
          title={suggest.isPending ? "Thinking…" : "✦ Suggest weights"}
          variant="ghost"
          disabled={suggest.isPending}
          onPress={runSuggest}
        />
        <ErrorNote error={suggest.error} />
        {rationale && <Muted style={styles.rationale}>{rationale}</Muted>}
      </Card>

      {parents.map((parent) => (
        <WeightGroup
          key={parent.id}
          parent={parent}
          nodes={childrenOf(parent.id)}
          weights={weights}
          onChange={(id, w) => setWeights((prev) => new Map(prev).set(id, w))}
        />
      ))}

      <ErrorNote error={save.error} />
      <Button
        title={save.isPending ? "Saving…" : "Lock in weights"}
        disabled={save.isPending}
        onPress={() =>
          save.mutate(
            [...weights].map(([nodeId, weight]) => ({ nodeId, weight })),
            { onSuccess: onSaved },
          )
        }
      />
      <Button title="← Edit build" variant="ghost" onPress={onBack} />
    </View>
  );
}

function WeightGroup({
  parent,
  nodes,
  weights,
  onChange,
}: {
  parent: RatingNodeDto;
  nodes: RatingNodeDto[];
  weights: Map<string, number>;
  onChange: (id: string, weight: number) => void;
}) {
  const values = nodes.map((n) => weights.get(n.id) ?? IMPORTANCE_MIN);
  const shares = normalizeWeights(values);
  return (
    <View style={{ gap: space.md }}>
      <Label>{parent.parentId === null ? "Overall is made of" : parent.name}</Label>
      {nodes.map((node, i) => (
        <View key={node.id} style={{ gap: space.xs }}>
          <View style={styles.weightHead}>
            <Body style={{ flex: 1, fontWeight: "600" }} numberOfLines={1}>
              {node.name}
            </Body>
            <Text style={styles.share}>{Math.round(shares[i]! * 100)}%</Text>
          </View>
          <View
            style={styles.scale}
            accessibilityRole="adjustable"
            accessibilityLabel={`${node.name} importance`}
            accessibilityValue={{ min: IMPORTANCE_MIN, max: IMPORTANCE_MAX, now: values[i] }}
          >
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                hitSlop={{ top: 8, bottom: 8 }}
                onPress={() => onChange(node.id, level)}
                style={[styles.step, level <= values[i]! && styles.stepOn]}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  rationale: { borderLeftWidth: 2, borderLeftColor: colors.neonDim, paddingLeft: space.md },
  weightHead: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  share: { color: colors.neon, fontFamily: fonts.heavy, fontSize: 18 },
  scale: { flexDirection: "row", gap: 3 },
  step: { flex: 1, height: 22, borderRadius: 4, backgroundColor: colors.court800 },
  stepOn: { backgroundColor: colors.neon },
});
