import {
  formatDuration,
  formatSet,
  HABIT_TYPE_LABELS,
  IMPORTANCE_LABELS,
  MAX_COACH_MESSAGE,
  suggestedHabitGoal,
  WEEKDAY_SHORT,
  type CoachActionDto,
  type CoachMessageDto,
  type CoachSuggestionDto,
  type ExerciseDto,
  type UnitSystem,
  type WorkoutExerciseDto,
} from "@rlo/shared";
import { useHeaderHeight } from "expo-router/react-navigation";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useCoach,
  useCoachThreads,
  useDeleteCoachThread,
  useResolveCoachSuggestion,
  useSendCoachMessage,
  useStartPostgame,
  useUndoCoachAction,
} from "@/api/coach";
import { useExercises } from "@/api/workouts";
import { weekdayDate } from "@/lib/format";
import { useUnits } from "@/lib/workouts";
import { useRatings } from "@/api/ratings";
import { Starters } from "@/components/CoachStarters";
import { Body, Button, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/**
 * The coach chat (web /coach), one thread at a time: "Chats" switches or deletes them, the
 * compose button starts a new one. `?ask=` sends one question in a new chat (Today's coach
 * card), `?thread=` opens one, and `?postgame=<date>` starts that day's postgame interview.
 */
function CoachScreen() {
  const talk = useTalk();
  const params = useLocalSearchParams<{ ask?: string; thread?: string; postgame?: string }>();
  const [ref, setRef] = useState(params.thread || "latest");
  const coach = useCoach(ref);
  const threads = useCoachThreads();
  const send = useSendCoachMessage();
  const remove = useDeleteCoachThread();
  const postgame = useStartPostgame();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [draft, setDraft] = useState("");
  const started = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const fresh = ref === "new";
  const thread = fresh ? null : (coach.data?.thread ?? null);
  const messages = fresh ? [] : (coach.data?.messages ?? []);
  const remaining = coach.data?.remaining ?? 0;
  const busy = send.isPending || postgame.isPending;

  const submit = (text: string, threadId = thread?.id ?? null) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    // Clear right away so it reads as sent; restore it if sending fails.
    setDraft("");
    send.mutate(
      { content: message, threadId },
      {
        onSuccess: (state) => state.thread && setRef(state.thread.id),
        onError: () => setDraft((current) => current || message),
      },
    );
  };

  // A link to another thread while this screen is open switches to it.
  useEffect(() => {
    if (params.thread) setRef(params.thread);
  }, [params.thread]);

  // Opened with a question or for a postgame: do it once.
  useEffect(() => {
    if (started.current || !coach.data) return;
    if (params.ask) {
      started.current = true;
      router.setParams({ ask: "" });
      setRef("new");
      submit(params.ask, null);
    } else if (params.postgame) {
      started.current = true;
      const date = params.postgame;
      router.setParams({ postgame: "" });
      postgame.mutate(date, { onSuccess: (state) => state.thread && setRef(state.thread.id) });
    }
  });

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, busy]);

  const openChats = () => {
    const list = (threads.data ?? []).slice(0, 12);
    const options = [
      ...list.map((t) => `${t.id === thread?.id ? "✓ " : ""}${t.title}`),
      ...(thread ? ["Delete this chat"] : []),
      "Cancel",
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Conversations",
        options,
        cancelButtonIndex: options.length - 1,
        ...(thread && { destructiveButtonIndex: list.length }),
      },
      (i) => {
        if (i < list.length) setRef(list[i]!.id);
        else if (thread && i === list.length) {
          Alert.alert("Delete this conversation?", thread.title, [
            { text: "Keep", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => remove.mutate(thread.id, { onSuccess: () => setRef("latest") }),
            },
          ]);
        }
      },
    );
  };

  if (coach.isPending) return <Loading title={talk.coach} />;
  if (coach.isError) {
    return (
      <Screen title={talk.coach}>
        <ErrorNote error={coach.error} onRetry={() => void coach.refetch()} />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.court950 }}
      keyboardVerticalOffset={headerHeight}
    >
      <Stack.Screen
        options={{
          title: thread?.title ?? talk.coach,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: space.lg, alignItems: "center" }}>
              {(threads.data?.length ?? 0) > 0 && (
                <Text
                  accessibilityRole="button"
                  style={{ color: colors.neon, fontSize: 16 }}
                  onPress={openChats}
                >
                  Chats
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New chat"
                hitSlop={8}
                onPress={() => setRef("new")}
              >
                <SymbolView name="square.and.pencil" tintColor={colors.neon} size={20} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scroll}
        style={{ flex: 1, backgroundColor: colors.court950 }}
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
      >
        {messages.length === 0 && !busy ? (
          <View style={styles.empty}>
            <CoachAvatar size={56} />
            <Text style={styles.eyebrow}>{talk.coachTagline}</Text>
            <Text style={styles.emptyTitle}>What are we working on?</Text>
            <Muted style={{ textAlign: "center" }}>
              The {talk.coach.toLowerCase()} knows your habits, goals, recent days and{" "}
              <Text style={{ color: colors.neon }} onPress={() => router.push("/scouting-report")}>
                {talk.scoutingReport}
              </Text>
              . Tell it what you did and it logs habits and drafts workouts; ask and it drafts
              habits, goals and templates for you to check.
            </Muted>
          </View>
        ) : null}
        {messages.map((m) => (
          <Message key={m.id} message={m} threadId={thread?.id ?? null} />
        ))}
        {send.isPending && (
          <Bubble role="user" pending>
            {send.variables?.content}
          </Bubble>
        )}
        {busy && <TypingBubble />}
        <ErrorNote error={send.error ?? remove.error ?? postgame.error} />
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        {messages.length === 0 && !busy && (
          <Starters onPick={submit} disabled={remaining === 0} inset={space.md} />
        )}
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel={`Message the ${talk.coach.toLowerCase()}`}
            value={draft}
            multiline
            maxLength={MAX_COACH_MESSAGE}
            editable={remaining > 0}
            onChangeText={setDraft}
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            placeholder={
              remaining === 0 ? "Daily limit reached" : `Ask the ${talk.coach.toLowerCase()}…`
            }
            placeholderTextColor={colors.court500}
            keyboardAppearance="dark"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!draft.trim() || busy || remaining === 0}
            onPress={() => submit(draft)}
            style={[styles.send, (!draft.trim() || busy || remaining === 0) && { opacity: 0.4 }]}
          >
            <SymbolView name="arrow.up" tintColor={colors.court950} size={18} weight="bold" />
          </Pressable>
        </View>
        {remaining <= 5 && (
          <Muted style={{ fontSize: 12, paddingHorizontal: space.sm, textAlign: "center" }}>
            {remaining} message{remaining === 1 ? "" : "s"} left in the last 24 hours.
          </Muted>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({
  role,
  pending = false,
  children,
}: {
  role: CoachMessageDto["role"];
  pending?: boolean;
  children: ReactNode;
}) {
  const user = role === "user";
  return (
    <View style={[styles.row, user && { justifyContent: "flex-end" }]}>
      {!user && <CoachAvatar size={28} />}
      <View
        style={[
          styles.bubble,
          user ? styles.userBubble : styles.coachBubble,
          pending && { opacity: 0.6 },
        ]}
      >
        <Text
          selectable
          style={{ color: user ? colors.court950 : colors.court100, fontSize: 16, lineHeight: 22 }}
        >
          {children}
        </Text>
      </View>
    </View>
  );
}

/** The coach's badge: a player on a neon disc. */
function CoachAvatar({ size }: { size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <SymbolView
        name="figure.basketball"
        tintColor={colors.court950}
        size={size * 0.6}
        weight="semibold"
      />
    </View>
  );
}

/** Three dots that pulse in turn while the coach writes a reply. */
function TypingBubble() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.stagger(
        150,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          ]),
        ),
      ),
    );
    loop.start();
    return () => loop.stop();
  }, [dots]);
  return (
    <View style={styles.row} accessibilityLabel="The coach is typing">
      <CoachAvatar size={28} />
      <View style={[styles.bubble, styles.coachBubble, styles.typing]}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

function Message({ message: m, threadId }: { message: CoachMessageDto; threadId: string | null }) {
  return (
    <View style={{ gap: space.sm }}>
      <Bubble role={m.role}>{m.content}</Bubble>
      {m.actions.map((a) => (
        <Receipt key={`a${a.index}`} messageId={m.id} action={a} />
      ))}
      {m.suggestions.map((s) =>
        s.kind === "report" ? (
          <ReportLine key={`s${s.index}`} messageId={m.id} suggestion={s} />
        ) : (
          <DraftCard key={`s${s.index}`} messageId={m.id} threadId={threadId} draft={s} />
        ),
      )}
    </View>
  );
}

const ACTION_LABEL: Record<CoachActionDto["kind"], string> = {
  workout: "Workout logged",
  habit: "Habit logged",
  goal: "Goal progress",
  newHabit: "Habit created",
  newGoal: "Goal created",
  template: "Template saved",
};

/** Something the coach logged, with undo (it writes to the day log directly). */
function Receipt({ messageId, action: a }: { messageId: string; action: CoachActionDto }) {
  const undo = useUndoCoachAction();
  return (
    <View
      style={[
        styles.suggestion,
        !a.undone && { borderColor: colors.neon },
        a.undone && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.kind}>
        {a.undone ? "Undone" : `✓ ${ACTION_LABEL[a.kind]}`} · {weekdayDate(a.date)}
      </Text>
      <Body style={[{ fontWeight: "600" }, a.undone && { textDecorationLine: "line-through" }]}>
        {a.title}
      </Body>
      <Muted style={{ fontSize: 13 }}>{a.detail}</Muted>
      <ErrorNote error={undo.error} />
      {!a.undone && (
        <Button
          title="Undo"
          variant="ghost"
          disabled={undo.isPending}
          onPress={() => undo.mutate({ messageId, index: a.index })}
        />
      )}
    </View>
  );
}

type Draft = Exclude<CoachSuggestionDto, { kind: "report" }>;

const DRAFT_LABEL: Record<Draft["kind"], string> = {
  workout: "Workout",
  template: "Workout template",
  habit: "Habit",
  goal: "Goal",
};

const SAVE_LABEL: Record<Draft["kind"], string> = {
  workout: "Looks right, save it",
  template: "Save template",
  habit: "Add habit",
  goal: "Add goal",
};

/** Lines describing a draft: its day and sets, schedule, or target. */
function draftFacts(
  d: Draft,
  names: Map<string, string>,
  library: ExerciseDto[],
  units: UnitSystem,
) {
  const byId = new Map(library.map((e) => [e.id, e]));
  const exercises = (list: WorkoutExerciseDto[]) =>
    list.map((e) => {
      const info = byId.get(e.exerciseId);
      const last = e.sets.findLast((x) => x.weightKg ?? x.reps ?? x.durationS ?? x.distanceM);
      const shown = last && info ? formatSet(info, last, units) : "";
      return `${info?.name ?? "Exercise"}: ${e.sets.length} set${e.sets.length === 1 ? "" : "s"}${shown ? ` · ${shown}` : ""}`;
    });
  const builds = (ids: string[]) => {
    const list = ids.map((id) => names.get(id)).filter(Boolean);
    return list.length ? [`Builds ${list.join(", ")}`] : [];
  };
  switch (d.kind) {
    case "workout":
      return [`${weekdayDate(d.date)} · ${formatDuration(d.durationS)}`, ...exercises(d.exercises)];
    case "template":
      return exercises(d.exercises);
    case "habit": {
      const schedule =
        d.days.length === 7 ? "Every day" : d.days.map((x) => WEEKDAY_SHORT[x]).join(", ");
      const amount = suggestedHabitGoal(d);
      return [
        `${HABIT_TYPE_LABELS[d.habitType]}${d.avoid ? " (avoid)" : ""} · ${schedule}${amount}`,
        ...builds(d.nodeIds),
      ];
    }
    case "goal":
      return [
        d.endsOn
          ? `${d.goalKind === "reach" ? `${d.startValue} → ` : ""}${d.target} ${d.unit} by ${weekdayDate(d.endsOn)}`
          : `${d.target} ${d.unit} in ${d.durationDays} days`,
        ...builds(d.nodeIds),
      ];
  }
}

/** Where a draft opens to be tweaked: the app's own editor, saving through the coach. */
function reviewHref(d: Draft, threadId: string | null, messageId: string) {
  const draft = { thread: threadId ?? "", message: messageId, index: String(d.index) };
  switch (d.kind) {
    case "habit":
      return { pathname: "/habits/edit", params: draft } as const;
    case "goal":
      return { pathname: "/goals/edit", params: draft } as const;
    case "template":
      return { pathname: "/workouts/template", params: draft } as const;
    case "workout":
      return { pathname: "/workouts/draft", params: draft } as const;
  }
}

/**
 * Something the coach drafted (web DraftCard): its details, and nothing saved until the
 * player saves it as is or after tweaking it.
 */
function DraftCard({
  messageId,
  threadId,
  draft: d,
}: {
  messageId: string;
  threadId: string | null;
  draft: Draft;
}) {
  const resolve = useResolveCoachSuggestion();
  const ratings = useRatings();
  const library = useExercises().data ?? [];
  const units = useUnits();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  const pending = d.status === "pending";
  return (
    <View style={[styles.suggestion, pending && { borderColor: colors.neon }]}>
      <Text style={styles.kind}>
        {DRAFT_LABEL[d.kind]}
        {pending ? " · draft, not saved" : d.status === "accepted" ? " · ✓ saved" : " · discarded"}
      </Text>
      <Body style={{ fontWeight: "600", fontSize: 17 }}>{d.name}</Body>
      {draftFacts(d, names, library, units).map((f, i) => (
        <Muted key={i} style={{ fontSize: 13 }}>
          {f}
        </Muted>
      ))}
      {d.reason ? <Muted style={{ fontSize: 13 }}>{d.reason}</Muted> : null}
      <ErrorNote error={resolve.error} />
      {pending && (
        <View style={{ gap: space.xs }}>
          <Button
            title={SAVE_LABEL[d.kind]}
            disabled={resolve.isPending}
            onPress={() => resolve.mutate({ messageId, index: d.index, action: "accept" })}
          />
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Review and tweak"
                variant="ghost"
                disabled={resolve.isPending}
                onPress={() => router.push(reviewHref(d, threadId, messageId))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Discard"
                variant="ghost"
                disabled={resolve.isPending}
                onPress={() => resolve.mutate({ messageId, index: d.index, action: "dismiss" })}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const SECTION_LABEL = {
  aspiration: "Aspiration",
  priority: "Priority",
  focus: "Focus",
  constraint: "Constraint",
} as const;

/** A line the coach offers for the Scouting Report; everything else comes as a DraftCard. */
function ReportLine({
  messageId,
  suggestion: s,
}: {
  messageId: string;
  suggestion: Extract<CoachSuggestionDto, { kind: "report" }>;
}) {
  const talk = useTalk();
  const resolve = useResolveCoachSuggestion();
  const ratings = useRatings();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  return (
    <View style={styles.suggestion}>
      <Text style={styles.kind}>{talk.scoutingReport}</Text>
      <Body style={{ fontWeight: "600" }}>{s.text}</Body>
      <Muted style={{ fontSize: 13, color: colors.court500 }}>
        {SECTION_LABEL[s.section]}
        {s.importance ? ` · ${IMPORTANCE_LABELS[s.importance]}` : ""}
        {s.nodeId ? ` · ${names.get(s.nodeId) ?? "?"}` : ""}
      </Muted>
      {s.reason ? <Muted style={{ fontSize: 13 }}>{s.reason}</Muted> : null}
      <ErrorNote error={resolve.error} />
      {s.status === "pending" ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Add to report"
              disabled={resolve.isPending}
              onPress={() => resolve.mutate({ messageId, index: s.index, action: "accept" })}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="No thanks"
              variant="ghost"
              disabled={resolve.isPending}
              onPress={() => resolve.mutate({ messageId, index: s.index, action: "dismiss" })}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.status}>{s.status === "accepted" ? "✓ Added" : "Dismissed"}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, paddingBottom: space.xl, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  emptyTitle: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 26,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "center",
  },
  eyebrow: { color: colors.neon, fontSize: 12, letterSpacing: 3, textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  avatar: { backgroundColor: colors.neon, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "80%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { backgroundColor: colors.neon, borderBottomRightRadius: 6 },
  coachBubble: {
    backgroundColor: colors.court900,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.court700,
    borderBottomLeftRadius: 6,
  },
  typing: { flexDirection: "row", gap: 5, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.court300 },
  suggestion: {
    gap: 4,
    marginLeft: 28 + space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
    borderRadius: 12,
    padding: space.md,
  },
  kind: { color: colors.neon, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  status: { color: colors.court500, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.court700,
    backgroundColor: colors.court950,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.sm,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: colors.court900,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.court700,
    color: colors.court100,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  },
  send: {
    backgroundColor: colors.neon,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function GatedCoachScreen() {
  return (
    <FeatureGate feature="coach">
      <CoachScreen />
    </FeatureGate>
  );
}
