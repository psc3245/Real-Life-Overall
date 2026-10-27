import type { TreeChangeDto, TreeProposalDto, WeightChangeDto } from "@rlo/shared";
import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useResolveTreeProposal, useUndoWeightChange } from "@/api/evolution";
import { shortDate } from "@/lib/format";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { Body, Button, ErrorNote, Muted } from "./ui";

/** Weight shifts made by weekly reviews, each undoable while its season is current. */
export function WeightShiftList({
  changes,
  undoable = true,
}: {
  changes: WeightChangeDto[];
  undoable?: boolean;
}) {
  const undo = useUndoWeightChange();
  return (
    <View style={{ gap: space.xs }}>
      {changes.map((c, i) => {
        const up = c.toShare > c.fromShare;
        return (
          <View key={c.id} style={[styles.shift, i > 0 && styles.border]}>
            <View style={{ flex: 1, opacity: c.revertedAt ? 0.5 : 1 }}>
              <Text style={{ color: colors.court300, fontSize: 15 }}>
                <Link
                  href={{ pathname: "/node/[id]", params: { id: c.nodeId } }}
                  style={styles.name}
                >
                  {c.nodeName}
                </Link>{" "}
                {c.fromShare}% →{" "}
                <Text style={{ color: up ? colors.neon : colors.flare }}>{c.toShare}%</Text>
                {c.revertedAt ? <Text style={styles.tag}> UNDONE</Text> : null}
              </Text>
              <Muted style={{ fontSize: 13 }}>{c.reason}</Muted>
            </View>
            {undoable && !c.revertedAt && (
              <Pressable
                accessibilityRole="button"
                disabled={undo.isPending}
                onPress={() => undo.mutate(c.id)}
                hitSlop={6}
                style={styles.undo}
              >
                <Text style={{ color: colors.neon, fontSize: 13 }}>Undo</Text>
              </Pressable>
            )}
          </View>
        );
      })}
      <ErrorNote error={undo.error} />
    </View>
  );
}

function ChangeLine({ change: c }: { change: TreeChangeDto }) {
  if (c.kind === "remove") {
    return (
      <Text style={styles.line}>
        <Text style={[styles.kind, { color: colors.flare }]}>REMOVE </Text>
        <Text style={styles.name}>{c.nodeName}</Text>
        <Text style={{ color: colors.court500, fontSize: 13 }}>
          {" "}
          (its history stays in the ledger)
        </Text>
      </Text>
    );
  }
  if (c.kind === "add_attribute") {
    return (
      <View>
        <Text style={styles.line}>
          <Text style={styles.kind}>ADD </Text>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={{ color: colors.court500 }}> to {c.parentName}</Text>
        </Text>
        {c.description ? <Muted style={{ fontSize: 13 }}>{c.description}</Muted> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.line}>
        <Text style={styles.kind}>ADD CATEGORY </Text>
        <Text style={styles.name}>{c.name}</Text>
      </Text>
      {c.description ? <Muted style={{ fontSize: 13 }}>{c.description}</Muted> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
        {c.attributes.map((a) => (
          <Text key={a.name} style={styles.attr}>
            {a.name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const STATUS_LABEL: Record<TreeProposalDto["status"], string> = {
  pending: "Waiting on you",
  accepted: "✓ Applied",
  dismissed: "Dismissed",
  expired: "Expired",
};

/** A proposed tree change: what it adds or removes, why, and accept/dismiss. */
export function TreeProposalCard({ proposal: p }: { proposal: TreeProposalDto }) {
  const talk = useTalk();
  const resolve = useResolveTreeProposal();
  const pending = p.status === "pending";
  return (
    <View style={[styles.proposal, pending && styles.proposalPending]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
        <Text style={styles.proposalTitle}>
          Suggested tree change · {shortDate(p.createdAt.slice(0, 10))}
        </Text>
        <Text style={styles.status}>{STATUS_LABEL[p.status]}</Text>
      </View>
      <Body>{p.reason}</Body>
      <View style={{ gap: space.sm }}>
        {p.changes.map((c, i) => (
          <ChangeLine key={i} change={c} />
        ))}
      </View>
      {pending && (
        <>
          <Muted style={{ fontSize: 13 }}>
            New attributes get a starting rating from {talk.scout}. Removed ones leave your rating
            for the rest of the season. You can always reshape the tree at the next season setup.
          </Muted>
          <Button
            title={
              resolve.isPending && resolve.variables?.action === "accept"
                ? "Rating new attributes…"
                : "Apply change"
            }
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ id: p.id, action: "accept" })}
          />
          <Button
            title="Keep my tree"
            variant="ghost"
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ id: p.id, action: "dismiss" })}
          />
        </>
      )}
      <ErrorNote error={resolve.error} />
    </View>
  );
}

const styles = StyleSheet.create({
  shift: { flexDirection: "row", alignItems: "flex-start", gap: space.md, paddingVertical: 6 },
  border: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.court800 },
  name: { color: colors.court100, fontWeight: "600", fontSize: 15 },
  tag: { color: colors.court500, fontSize: 11, letterSpacing: 1 },
  undo: {
    borderWidth: 1,
    borderColor: colors.neonDim,
    borderRadius: 8,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  line: { color: colors.court100, fontSize: 15 },
  kind: { color: colors.neon, fontFamily: fonts.display, fontSize: 12, letterSpacing: 1 },
  attr: {
    color: colors.court300,
    backgroundColor: colors.court800,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    overflow: "hidden",
  },
  proposal: {
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.court700,
    borderRadius: 12,
    padding: space.md,
  },
  proposalPending: { borderColor: colors.neonDim, backgroundColor: "rgba(60,242,200,0.05)" },
  proposalTitle: {
    flex: 1,
    color: colors.court300,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  status: { color: colors.court500, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
});
