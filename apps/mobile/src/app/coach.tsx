import {
  HABIT_TYPE_LABELS,
  IMPORTANCE_LABELS,
  MAX_COACH_MESSAGE,
  WEEKDAY_SHORT,
  type CoachMessageDto,
  type CoachSuggestionDto,
} from "@rlo/shared";
import { useHeaderHeight } from "expo-router/react-navigation";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
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
  useClearCoach,
  useCoach,
  useResolveCoachSuggestion,
  useSendCoachMessage,
} from "@/api/coach";
import { useRatings } from "@/api/ratings";
import { Starters } from "@/components/CoachStarters";
import { Body, Button, ErrorNote, Loading, Muted, Screen } from "@/components/ui";
import { useTalk } from "@/lib/talk";
import { colors, fonts, space } from "@/lib/theme";
import { FeatureGate } from "@/components/FeatureGate";

/** The coach chat (web /coach). `?ask=` sends one question on open (Today's coach card). */
function CoachScreen() {
  const talk = useTalk();
  const coach = useCoach();
  const send = useSendCoachMessage();
  const clear = useClearCoach();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const [draft, setDraft] = useState("");
  const asked = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const messages = coach.data?.messages ?? [];
  const remaining = coach.data?.remaining ?? 0;

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    // Clear right away so it reads as sent; restore it if sending fails.
    setDraft("");
    send.mutate(message, { onError: () => setDraft((current) => current || message) });
  };

  useEffect(() => {
    if (!ask || asked.current || !coach.data) return;
    asked.current = true;
    router.setParams({ ask: "" });
    submit(ask);
  });

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, send.isPending]);

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
          title: talk.coach,
          headerRight:
            messages.length > 0
              ? () => (
                  <Text
                    accessibilityRole="button"
                    style={{ color: colors.flare, fontSize: 16 }}
                    onPress={() =>
                      Alert.alert("Clear the whole conversation?", undefined, [
                        { text: "Keep", style: "cancel" },
                        { text: "Clear", style: "destructive", onPress: () => clear.mutate() },
                      ])
                    }
                  >
                    Clear
                  </Text>
                )
              : undefined,
        }}
      />
      <ScrollView
        ref={scroll}
        style={{ flex: 1, backgroundColor: colors.court950 }}
        contentContainerStyle={styles.list}
        keyboardDismissMode="interactive"
      >
        {messages.length === 0 && !send.isPending ? (
          <View style={styles.empty}>
            <CoachAvatar size={56} />
            <Text style={styles.eyebrow}>{talk.coachTagline}</Text>
            <Text style={styles.emptyTitle}>What are we working on?</Text>
            <Muted style={{ textAlign: "center" }}>
              The {talk.coach.toLowerCase()} knows your habits, goals, recent days and{" "}
              <Text style={{ color: colors.neon }} onPress={() => router.push("/scouting-report")}>
                {talk.scoutingReport}
              </Text>
              , and can suggest habits and goals you add with one tap.
            </Muted>
          </View>
        ) : null}
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {send.isPending && (
          <>
            <Bubble role="user" pending>
              {send.variables}
            </Bubble>
            <TypingBubble />
          </>
        )}
        <ErrorNote error={send.error ?? clear.error} />
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        {messages.length === 0 && !send.isPending && (
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
            disabled={!draft.trim() || send.isPending || remaining === 0}
            onPress={() => submit(draft)}
            style={[
              styles.send,
              (!draft.trim() || send.isPending || remaining === 0) && { opacity: 0.4 },
            ]}
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

function Message({ message: m }: { message: CoachMessageDto }) {
  return (
    <View style={{ gap: space.sm }}>
      <Bubble role={m.role}>{m.content}</Bubble>
      {m.suggestions.map((s) => (
        <Suggestion key={s.index} messageId={m.id} suggestion={s} />
      ))}
    </View>
  );
}

const KIND_LABEL: Record<CoachSuggestionDto["kind"], string> = {
  habit: "Habit",
  goal: "Goal",
  report: "Scouting Report",
};

const ADD_LABEL: Record<CoachSuggestionDto["kind"], string> = {
  habit: "Add habit",
  goal: "Add goal",
  report: "Add to report",
};

const SECTION_LABEL = {
  aspiration: "Aspiration",
  priority: "Priority",
  focus: "Focus",
  constraint: "Constraint",
} as const;

function describe(s: CoachSuggestionDto, names: Map<string, string>) {
  const nodes =
    s.kind !== "report" && s.nodeIds.length
      ? ` · ${s.nodeIds.map((id) => names.get(id) ?? "?").join(", ")}`
      : "";
  if (s.kind === "habit") {
    const schedule =
      s.days.length === 7 ? "every day" : s.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    const goal =
      s.target !== null
        ? ` · goal ${s.target} ${s.habitType === "duration" ? "min" : (s.unit ?? "")}`
        : "";
    return `${HABIT_TYPE_LABELS[s.habitType]} · ${schedule}${goal}${nodes}`;
  }
  if (s.kind === "goal") {
    return `${s.target} ${s.unit} in ${s.durationDays} day${s.durationDays === 1 ? "" : "s"}${nodes}`;
  }
  return `${SECTION_LABEL[s.section]}${
    s.importance ? ` · ${IMPORTANCE_LABELS[s.importance]}` : ""
  }${s.nodeId ? ` · ${names.get(s.nodeId) ?? "?"}` : ""}`;
}

function Suggestion({
  messageId,
  suggestion: s,
}: {
  messageId: string;
  suggestion: CoachSuggestionDto;
}) {
  const talk = useTalk();
  const resolve = useResolveCoachSuggestion();
  const ratings = useRatings();
  const names = new Map((ratings.data?.nodes ?? []).map((n) => [n.id, n.name]));
  return (
    <View style={styles.suggestion}>
      <Text style={styles.kind}>
        {s.kind === "report" ? talk.scoutingReport : KIND_LABEL[s.kind]}
      </Text>
      <Body style={{ fontWeight: "600" }}>{s.kind === "report" ? s.text : s.name}</Body>
      <Muted style={{ fontSize: 13, color: colors.court500 }}>{describe(s, names)}</Muted>
      {s.reason ? <Muted style={{ fontSize: 13 }}>{s.reason}</Muted> : null}
      <ErrorNote error={resolve.error} />
      {s.status === "pending" ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title={ADD_LABEL[s.kind]}
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
