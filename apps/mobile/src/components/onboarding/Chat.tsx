import { MAX_CHAT_MESSAGE, type ChatMessageDto } from "@rlo/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, space } from "@/lib/theme";
import { Button, Field } from "../ui";

/** Chat bubbles plus a reply box: the discovery and follow-up conversations. */
export function Chat({
  messages,
  pendingReply,
  waiting,
  disabled,
  onSend,
}: {
  messages: ChatMessageDto[];
  /** The reply being sent, shown faded until the scout answers. */
  pendingReply?: string;
  waiting: boolean;
  disabled?: boolean;
  /** Returns false if sending failed, so the text goes back in the box. */
  onSend: (message: string, restore: () => void) => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    const message = text.trim();
    if (!message || waiting) return;
    setText("");
    onSend(message, () => setText((current) => current || message));
  };

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
        {messages.map((m, i) => (
          <Bubble key={i} mine={m.role === "user"} text={m.content} />
        ))}
        {waiting && (
          <>
            {pendingReply && <Bubble mine text={pendingReply} faded />}
            <Bubble mine={false} text="…" faded />
          </>
        )}
      </View>
      <View style={styles.reply}>
        <Field
          value={text}
          maxLength={MAX_CHAT_MESSAGE}
          editable={!disabled}
          onChangeText={setText}
          placeholder="Type your answer…"
          multiline
          style={styles.input}
        />
        <Button title="Send" disabled={!text.trim() || waiting || disabled} onPress={send} />
      </View>
    </View>
  );
}

function Bubble({ mine, text, faded }: { mine: boolean; text: string; faded?: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, faded && { opacity: 0.6 }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "85%", borderRadius: 18, paddingHorizontal: space.lg, paddingVertical: 10 },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(60,242,200,0.15)",
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  text: { color: colors.court100, fontSize: 16, lineHeight: 22 },
  reply: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: { flex: 1, minHeight: 48, maxHeight: 140 },
});
