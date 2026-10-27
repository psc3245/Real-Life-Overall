import {
  IMPORTANCE_LABELS,
  MAX_ASPIRATIONS,
  MAX_CONSTRAINTS,
  MAX_PRIORITIES,
  MAX_REPORT_FOCUSES,
  MAX_REPORT_LINE,
  type ScoutingReportBody,
  type ScoutingReportDto,
  type WeightsDto,
} from "@rlo/shared";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useSaveScoutingReport,
  useScoutingReport,
  useTreeProposals,
  useWeights,
} from "@/api/evolution";
import { usePreferences } from "@/api/preferences";
import { FormRow } from "@/components/controls";
import { NodeChip } from "@/components/NodeChip";
import { TreeProposalCard, WeightShiftList } from "@/components/TreeEvolution";
import {
  Body,
  Button,
  Card,
  ErrorNote,
  Field,
  Label,
  Loading,
  Muted,
  Screen,
  Section,
} from "@/components/ui";
import { shortDate } from "@/lib/format";
import { cap, useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";

/** What the player is playing for, the rating's shape, and tree change suggestions. */
export default function ScoutingReportScreen() {
  const talk = useTalk();
  const report = useScoutingReport();
  const weights = useWeights();
  const proposals = useTreeProposals();
  const [editing, setEditing] = useState(false);

  if (report.isPending) return <Loading title={talk.scoutingReport} />;
  if (report.isError) {
    return (
      <Screen title={talk.scoutingReport}>
        <ErrorNote error={report.error} onRetry={() => void report.refetch()} />
      </Screen>
    );
  }
  const r = report.data;

  return (
    <Screen
      eyebrow={talk.scoutingReportTagline}
      title={talk.scoutingReport}
      onRefresh={() => Promise.all([report.refetch(), weights.refetch(), proposals.refetch()])}
    >
      <Muted>
        {cap(talk.scout)}&apos;s picture of what you want out of life. Each weekly review updates
        it, and your rating is tuned to match it: weights drift toward what matters to you, and now
        and then {talk.scout} suggests adding or removing part of your tree.
      </Muted>
      {r.updatedAt && (
        <Muted style={{ fontSize: 13, color: colors.court500 }}>
          Updated {shortDate(r.updatedAt.slice(0, 10))} by{" "}
          {r.updatedBy === "user" ? "you" : talk.scout}
        </Muted>
      )}

      {editing ? (
        <ReportEditor report={r} onDone={() => setEditing(false)} />
      ) : (
        <ReportView report={r} onEdit={() => setEditing(true)} />
      )}

      <Label>Rating shape</Label>
      <ErrorNote error={weights.error} />
      {weights.data && <RatingShape weights={weights.data} />}

      <Label>Tree changes</Label>
      <Muted style={{ fontSize: 13 }}>
        The tree changes rarely: at most one suggestion every four weeks, never in a season&apos;s
        last two weeks, and only with your OK.
      </Muted>
      <ErrorNote error={proposals.error} />
      {proposals.data?.length === 0 && (
        <Card>
          <Muted style={{ textAlign: "center" }}>
            No suggestions yet. Your tree fits what {talk.scout} knows so far.
          </Muted>
        </Card>
      )}
      {proposals.data?.map((p) => (
        <TreeProposalCard key={p.id} proposal={p} />
      ))}
    </Screen>
  );
}

function Importance({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
      accessibilityLabel={IMPORTANCE_LABELS[value]}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={4}>
          <View
            style={[
              styles.dot,
              onChange && styles.dotBig,
              { backgroundColor: i <= value ? colors.neon : colors.court700 },
            ]}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ReportView({ report: r, onEdit }: { report: ScoutingReportDto; onEdit: () => void }) {
  const talk = useTalk();
  const empty =
    !r.aspirations.length && !r.priorities.length && !r.focuses.length && !r.constraints.length;
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <View style={{ gap: 4 }}>
        <Text style={styles.subhead}>{title}</Text>
        {items.map((i) => (
          <Body key={i}>
            <Text style={{ color: colors.neon }}>• </Text>
            {i}
          </Body>
        ))}
      </View>
    );
  return (
    <Section title="The report">
      {empty && (
        <Muted>
          Empty for now. {cap(talk.scout)} writes it after your next weekly review, or you can fill
          it in yourself.
        </Muted>
      )}
      {list("Aspirations", r.aspirations)}
      {r.priorities.length > 0 && (
        <View style={{ gap: 4 }}>
          <Text style={styles.subhead}>Priorities</Text>
          {r.priorities.map((p, i) => (
            <View key={p.area} style={[styles.priority, i > 0 && styles.border]}>
              <View style={styles.priorityHead}>
                <Importance value={p.importance} />
                <Body style={{ fontWeight: "600", flexShrink: 1 }}>{p.area}</Body>
                {p.nodeId ? (
                  <NodeChip id={p.nodeId} name={p.nodeName ?? undefined} />
                ) : (
                  <Text style={styles.notInTree}>Not in your tree</Text>
                )}
              </View>
              {p.note ? <Muted style={{ fontSize: 13 }}>{p.note}</Muted> : null}
            </View>
          ))}
        </View>
      )}
      {list("Current focuses", r.focuses)}
      {list("Constraints", r.constraints)}
      <Button title={empty ? "Fill it in" : "Edit"} variant="ghost" onPress={onEdit} />
    </Section>
  );
}

/** Text lines with add and remove. */
function LinesField({
  label,
  values,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  values: string[];
  max: number;
  placeholder: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <FormRow label={label}>
      {values.map((v, i) => (
        <View key={i} style={styles.line}>
          <Field
            accessibilityLabel={`${label} ${i + 1}`}
            value={v}
            maxLength={MAX_REPORT_LINE}
            placeholder={placeholder}
            onChangeText={(t) => onChange(values.map((x, j) => (j === i ? t : x)))}
            style={{ flex: 1 }}
          />
          <Remove
            label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onPress={() => onChange(values.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      {values.length < max && (
        <Pressable onPress={() => onChange([...values, ""])} hitSlop={6}>
          <Text style={{ color: colors.neon, fontSize: 15 }}>+ Add</Text>
        </Pressable>
      )}
    </FormRow>
  );
}

function Remove({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}>
      <Text style={{ color: colors.flare, fontSize: 18, paddingHorizontal: 4 }}>✕</Text>
    </Pressable>
  );
}

function ReportEditor({ report, onDone }: { report: ScoutingReportDto; onDone: () => void }) {
  const save = useSaveScoutingReport();
  const weights = useWeights();
  const [draft, setDraft] = useState<ScoutingReportBody>({
    aspirations: report.aspirations,
    priorities: report.priorities.map(({ area, importance, nodeId, note }) => ({
      area,
      importance,
      nodeId,
      note,
    })),
    focuses: report.focuses,
    constraints: report.constraints,
  });
  const set = <K extends keyof ScoutingReportBody>(key: K, value: ScoutingReportBody[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const nodes = weights.data?.nodes ?? [];
  const names = new Map(nodes.map((n) => [n.nodeId, n.name]));
  const clean = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

  const pickNode = (onPick: (id: string | null) => void) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Measured by",
        options: [
          "Not in my tree",
          ...nodes.map((n) => `${n.depth > 1 ? "— " : ""}${n.name}`),
          "Cancel",
        ],
        cancelButtonIndex: nodes.length + 1,
        userInterfaceStyle: "dark",
      },
      (i) => {
        if (i === 0) onPick(null);
        else if (i <= nodes.length) onPick(nodes[i - 1]!.nodeId);
      },
    );

  return (
    <Card style={{ gap: space.lg, borderColor: colors.neonDim }}>
      <LinesField
        label="Aspirations"
        values={draft.aspirations}
        max={MAX_ASPIRATIONS}
        placeholder="e.g. Run a marathon before I'm 40"
        onChange={(v) => set("aspirations", v)}
      />

      <FormRow label="Priorities">
        {draft.priorities.map((p, i) => {
          const update = (patch: Partial<typeof p>) =>
            set(
              "priorities",
              draft.priorities.map((x, j) => (j === i ? { ...x, ...patch } : x)),
            );
          return (
            <View key={i} style={styles.priorityEdit}>
              <View style={styles.line}>
                <Field
                  accessibilityLabel={`Priority ${i + 1} area`}
                  value={p.area}
                  placeholder="Life area"
                  onChangeText={(area) => update({ area })}
                  style={{ flex: 1 }}
                />
                <Remove
                  label={`Remove priority ${i + 1}`}
                  onPress={() =>
                    set(
                      "priorities",
                      draft.priorities.filter((_, j) => j !== i),
                    )
                  }
                />
              </View>
              <View style={[styles.line, { justifyContent: "space-between" }]}>
                <Importance
                  value={p.importance}
                  onChange={(importance) => update({ importance })}
                />
                <Muted style={{ fontSize: 13 }}>{IMPORTANCE_LABELS[p.importance]}</Muted>
              </View>
              <Pressable onPress={() => pickNode((nodeId) => update({ nodeId }))} hitSlop={4}>
                <Text style={{ color: colors.court300, fontSize: 14 }}>
                  Measured by:{" "}
                  <Text style={{ color: colors.neon }}>
                    {p.nodeId ? (names.get(p.nodeId) ?? "?") : "Not in my tree"}
                  </Text>
                </Text>
              </Pressable>
              <Field
                accessibilityLabel={`Priority ${i + 1} note`}
                value={p.note}
                maxLength={MAX_REPORT_LINE}
                placeholder="Why it matters (optional)"
                onChangeText={(note) => update({ note })}
              />
            </View>
          );
        })}
        {draft.priorities.length < MAX_PRIORITIES && (
          <Pressable
            hitSlop={6}
            onPress={() =>
              set("priorities", [
                ...draft.priorities,
                { area: "", importance: 3, nodeId: null, note: "" },
              ])
            }
          >
            <Text style={{ color: colors.neon, fontSize: 15 }}>+ Add</Text>
          </Pressable>
        )}
      </FormRow>

      <LinesField
        label="Current focuses"
        values={draft.focuses}
        max={MAX_REPORT_FOCUSES}
        placeholder="e.g. Getting promoted this cycle"
        onChange={(v) => set("focuses", v)}
      />
      <LinesField
        label="Constraints"
        values={draft.constraints}
        max={MAX_CONSTRAINTS}
        placeholder="e.g. Knee injury, no running until spring"
        onChange={(v) => set("constraints", v)}
      />
      <ErrorNote error={save.error} />
      <Button
        title={save.isPending ? "Saving…" : "Save report"}
        disabled={save.isPending}
        onPress={() =>
          save.mutate(
            {
              aspirations: clean(draft.aspirations),
              priorities: draft.priorities.filter((p) => p.area.trim()),
              focuses: clean(draft.focuses),
              constraints: clean(draft.constraints),
            },
            { onSuccess: onDone },
          )
        }
      />
      <Button title="Cancel" variant="ghost" onPress={onDone} />
    </Card>
  );
}

/** Every node's share of its parent now, against season start, plus the shifts that moved it. */
function RatingShape({ weights }: { weights: WeightsDto }) {
  const prefs = usePreferences();
  const categories = weights.nodes.filter((n) => n.depth === 1);
  return (
    <View style={{ gap: space.md }}>
      {!weights.adaptive && (
        <Card style={{ gap: space.xs }}>
          <Muted>
            Adaptive rating is off, so weekly reviews leave your weights and tree alone.
          </Muted>
          <Pressable onPress={() => router.push("/personalize")}>
            <Text style={{ color: colors.neon }}>Turn it on →</Text>
          </Pressable>
        </Card>
      )}
      {categories.map((c) => (
        <Card key={c.nodeId} style={{ gap: space.sm }}>
          <ShareBar name={c.name} share={c.share} start={c.startShare} bold />
          {weights.nodes
            .filter((n) => n.parentId === c.nodeId)
            .map((n) => (
              <ShareBar key={n.nodeId} name={n.name} share={n.share} start={n.startShare} />
            ))}
        </Card>
      ))}
      <Muted style={{ fontSize: 13, color: colors.court500 }}>
        Bars show each part&apos;s share of its parent. The tick marks where it started the season.
        {prefs.features.adaptiveRating &&
          " Shifts are small (15% of a weight at most per week) and stay within half to double the starting weight."}
      </Muted>
      {weights.changes.length > 0 && (
        <Section title="Weight shifts">
          <WeightShiftList changes={weights.changes} />
        </Section>
      )}
    </View>
  );
}

function ShareBar({
  name,
  share,
  start,
  bold = false,
}: {
  name: string;
  share: number;
  start: number;
  bold?: boolean;
}) {
  const moved = share - start;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.shareHead}>
        <Text style={bold ? styles.shareBold : styles.shareName}>{name}</Text>
        <Text style={styles.shareValue}>
          {share}%
          {Math.abs(moved) >= 0.1 && (
            <Text style={{ fontSize: 12, color: moved > 0 ? colors.neon : colors.flare }}>
              {" "}
              {moved > 0 ? "+" : ""}
              {moved.toFixed(1)}
            </Text>
          )}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.min(100, share)}%`, opacity: bold ? 1 : 0.6 }]}
        />
        <View style={[styles.tick, { left: `${Math.min(100, start)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subhead: {
    color: colors.court300,
    fontFamily: fonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotBig: { width: 18, height: 18, borderRadius: 9 },
  priority: { gap: 4, paddingVertical: space.sm },
  priorityHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  notInTree: {
    color: colors.court500,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.court500,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  line: { flexDirection: "row", alignItems: "center", gap: space.sm },
  priorityEdit: {
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.court800,
    borderRadius: 10,
    padding: space.md,
  },
  shareHead: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  shareBold: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  shareName: { color: colors.court300, fontSize: 14 },
  shareValue: { color: colors.court100, fontFamily: fonts.display, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.court800 },
  fill: { height: "100%", borderRadius: 3, backgroundColor: colors.neon },
  tick: {
    position: "absolute",
    top: -2,
    width: 2,
    height: 10,
    marginLeft: -1,
    backgroundColor: colors.court100,
  },
});
