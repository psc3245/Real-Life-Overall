import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { colors, fonts, space } from "@/lib/theme";

/** A scrolling page with pull to refresh. Insets come from the native tab bar and header. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.neon} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Small uppercase label above a section, like the web's section headings. */
export function Label({ children, style, ...props }: TextProps) {
  return (
    <Text style={[styles.label, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }: TextProps) {
  return (
    <Text style={[styles.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...props }: TextProps) {
  return (
    <Text style={[styles.muted, style]} {...props}>
      {children}
    </Text>
  );
}

export function Button({
  title,
  onPress,
  disabled,
  busy,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: "primary" | "ghost";
}) {
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonGhost,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.court950 : colors.neon} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? colors.court950 : colors.neon }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.neon} />
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Card style={{ gap: space.md }}>
      <Body style={{ color: colors.flare }}>
        {error instanceof Error ? error.message : "Something went wrong."}
      </Body>
      {onRetry && <Button title="Try again" variant="ghost" onPress={onRetry} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.court950 },
  screenContent: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  card: {
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space.lg,
  },
  label: {
    color: colors.court300,
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  body: { color: colors.court100, fontSize: 16, lineHeight: 22 },
  muted: { color: colors.court300, fontSize: 14, lineHeight: 20 },
  button: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.lg,
  },
  buttonPrimary: { backgroundColor: colors.neon },
  buttonGhost: { borderColor: colors.neonDim, borderWidth: 1 },
  buttonText: {
    fontFamily: fonts.display,
    fontSize: 17,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl },
});
