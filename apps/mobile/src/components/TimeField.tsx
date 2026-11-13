import { formatTimeOfDay, parseTimeOfDay } from "@rlo/shared";
import { useEffect, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Field } from "./ui";

/**
 * A time of day typed as "6:30", "6:30 pm" or "18:30" (minutes after midnight in and out).
 * Unreadable text snaps back; clearing it gives null.
 */
export function TimeField({
  value,
  onChange,
  disabled,
  placeholder = "6:30 AM",
  accessibilityLabel,
  style,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  accessibilityLabel: string;
  style?: StyleProp<TextStyle>;
}) {
  const shown = value === null ? "" : formatTimeOfDay(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    if (!text.trim()) return value !== null && onChange(null);
    const parsed = parseTimeOfDay(text);
    if (parsed === null) setText(shown);
    else if (parsed !== value) onChange(parsed);
    else setText(shown);
  };
  return (
    <Field
      accessibilityLabel={accessibilityLabel}
      value={text}
      editable={!disabled}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="numbers-and-punctuation"
      returnKeyType="done"
      onChangeText={setText}
      onEndEditing={commit}
      style={[{ width: 112, textAlign: "center", paddingVertical: 7 }, style]}
    />
  );
}
