import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, space } from "@/lib/theme";

/**
 * A native page sheet with an iOS-style bar: Cancel on the left, the title, and an optional
 * action on the right. Children scroll themselves (lists) or sit in a padded column.
 */
export function Sheet({
  open,
  title,
  onClose,
  action,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  action?: { label: string; onPress: () => void; disabled?: boolean };
  children: ReactNode;
}) {
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={styles.sheet}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button">
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {action ? (
            <Pressable
              onPress={action.onPress}
              disabled={action.disabled}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.action, action.disabled && { opacity: 0.4 }]}>
                {action.label}
              </Text>
            </Pressable>
          ) : (
            <View style={{ width: 52 }} />
          )}
        </View>
        <View style={styles.body}>{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.court950 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.court700,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cancel: { color: colors.court300, fontSize: 16, width: 52 },
  action: { color: colors.neon, fontSize: 16, fontWeight: "600", minWidth: 52, textAlign: "right" },
  body: { flex: 1, padding: space.lg, gap: space.md },
});
