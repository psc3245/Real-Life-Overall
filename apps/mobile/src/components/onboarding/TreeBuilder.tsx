import {
  CATEGORY_TEMPLATES,
  MAX_NODE_DESCRIPTION_LENGTH,
  MAX_NODE_NAME_LENGTH,
  MAX_RATING_DEPTH,
  treeDraftSchema,
  type TreeDraftNode,
} from "@rlo/shared";
import { SymbolView } from "expo-symbols";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSuggestAttributes } from "@/api/onboarding";
import {
  addNode,
  addTemplate,
  childrenOf,
  depthOf,
  removeNode,
  updateNode,
  usedTemplateKeys,
  type Draft,
} from "@/lib/draft";
import { colors, fonts, space } from "@/lib/theme";
import { Chip } from "../controls";
import { Button, Card, ErrorNote, Label, Muted } from "../ui";

const LEVEL_NAMES = ["", "category", "attribute", "sub-attribute"];

function validate(draft: Draft): string | null {
  if (childrenOf(draft, null).length === 0) return "Add at least one category to get started.";
  if (draft.some((n) => !n.name.trim())) return "Every category and attribute needs a name.";
  const result = treeDraftSchema.safeParse({ nodes: draft });
  return result.success ? null : (result.error.issues[0]?.message ?? "The tree is invalid.");
}

/** Build the rating tree: starter categories, custom ones, attributes and AI suggestions. */
export function TreeBuilder({
  initial,
  saving,
  saveError,
  onSave,
  saveLabel = "Save & set weights",
}: {
  initial: Draft;
  saving: boolean;
  saveError: unknown;
  onSave: (draft: Draft) => void;
  saveLabel?: string;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const used = usedTemplateKeys(draft);
  const categories = childrenOf(draft, null);
  const problem = validate(draft);

  const toggleTemplate = (key: string) => {
    const existing = categories.find((c) => c.templateKey === key);
    const template = CATEGORY_TEMPLATES.find((t) => t.key === key)!;
    setDraft((d) => (existing ? removeNode(d, existing.key) : addTemplate(d, template)));
  };

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Label>Starter categories</Label>
        <Muted>Tap to add a category with suggested attributes. Everything stays editable.</Muted>
        <View style={styles.wrap}>
          {CATEGORY_TEMPLATES.map((t) => (
            <Chip
              key={t.key}
              label={`${used.has(t.key) ? "✓" : "+"} ${t.name}`}
              selected={used.has(t.key)}
              onPress={() => toggleTemplate(t.key)}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <View style={styles.head}>
          <Label>Your build</Label>
          <Button
            title="+ Category"
            variant="ghost"
            onPress={() => setDraft((d) => addNode(d, null))}
          />
        </View>
        {categories.length === 0 && (
          <Card>
            <Muted>No categories yet. Pick a starter above or create your own.</Muted>
          </Card>
        )}
        {categories.map((c) => (
          <Card key={c.key}>
            <NodeEditor node={c} draft={draft} setDraft={setDraft} />
          </Card>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        {problem ? <Muted>{problem}</Muted> : <ErrorNote error={saveError} />}
        <Button
          title={saving ? "Saving…" : saveLabel}
          disabled={!!problem || saving}
          onPress={() => onSave(draft)}
        />
      </View>
    </View>
  );
}

function NodeEditor({
  node,
  draft,
  setDraft,
}: {
  node: TreeDraftNode;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
}) {
  const depth = depthOf(draft, node.key);
  const children = childrenOf(draft, node.key);
  const canNest = depth < MAX_RATING_DEPTH;
  const suggest = useSuggestAttributes();
  const [showDescription, setShowDescription] = useState(Boolean(node.description));
  const level = LEVEL_NAMES[depth] ?? "attribute";
  const childLevel = LEVEL_NAMES[depth + 1] ?? "attribute";

  const runSuggest = () =>
    suggest.mutate(
      { name: node.name, description: node.description, existing: children.map((c) => c.name) },
      {
        onSuccess: (attributes) =>
          setDraft((d) => attributes.reduce((next, a) => addNode(next, node.key, a), d)),
      },
    );

  return (
    <View style={[{ gap: space.sm }, depth > 1 && styles.nested]}>
      <View style={styles.nameRow}>
        <TextInput
          accessibilityLabel={`${level} name`}
          value={node.name}
          maxLength={MAX_NODE_NAME_LENGTH}
          placeholder={`Name this ${level}`}
          placeholderTextColor={colors.court500}
          keyboardAppearance="dark"
          onChangeText={(name) => setDraft((d) => updateNode(d, node.key, { name }))}
          style={[styles.name, depth === 1 && styles.category]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${node.name || level}`}
          hitSlop={8}
          onPress={() => setDraft((d) => removeNode(d, node.key))}
        >
          <SymbolView name="xmark.circle.fill" tintColor={colors.court500} size={22} />
        </Pressable>
      </View>
      {showDescription && (
        <TextInput
          accessibilityLabel={`${level} description`}
          value={node.description}
          maxLength={MAX_NODE_DESCRIPTION_LENGTH}
          placeholder="What does this measure?"
          placeholderTextColor={colors.court500}
          keyboardAppearance="dark"
          onChangeText={(description) => setDraft((d) => updateNode(d, node.key, { description }))}
          style={styles.description}
        />
      )}
      <View style={styles.actions}>
        {!showDescription && <Action label="+ note" onPress={() => setShowDescription(true)} />}
        {canNest && (
          <Action label={`+ ${childLevel}`} onPress={() => setDraft((d) => addNode(d, node.key))} />
        )}
        {canNest && (
          <Action
            label={suggest.isPending ? "Thinking…" : "✦ Suggest"}
            disabled={!node.name.trim() || suggest.isPending}
            onPress={runSuggest}
          />
        )}
      </View>
      <ErrorNote error={suggest.error} />
      {children.map((child) => (
        <NodeEditor key={child.key} node={child} draft={draft} setDraft={setDraft} />
      ))}
    </View>
  );
}

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={disabled && { opacity: 0.4 }}
    >
      <Text style={styles.action}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nested: { borderLeftWidth: 1, borderLeftColor: colors.court700, paddingLeft: space.md },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  name: { flex: 1, color: colors.court100, fontSize: 16, paddingVertical: 4 },
  category: { fontFamily: fonts.heavy, fontSize: 22, textTransform: "uppercase" },
  description: { color: colors.court300, fontSize: 14, paddingVertical: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  action: { color: colors.neon, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
});
