import { Link, type Href } from "expo-router";
import { createContext, useContext, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, space } from "@/lib/theme";

/** True inside a tab's own stack, where screens have no header to cover the status bar. */
export const TabRootContext = createContext(false);

/** A scrolling page with a big 2K-style title and pull to refresh. Insets come from the tab bar. */
export function Screen({
  title,
  eyebrow,
  subtitle,
  children,
  onRefresh,
  refreshing = false,
}: {
  title?: string;
  eyebrow?: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const tabRoot = useContext(TabRootContext);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
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
        {title && (
          <View>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {subtitle && <Label>{subtitle}</Label>}
          </View>
        )}
        {children}
      </ScrollView>
      {tabRoot && <View style={[styles.scrim, { height: insets.top }]} />}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
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

/** A titled card, like the web's dashboard cards, with an optional link on the right. */
export function Section({
  title,
  action,
  children,
  style,
}: {
  title: string;
  action?: { label: string; href: Href };
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[{ gap: space.md }, style]}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action && <TextLink href={action.href}>{action.label}</TextLink>}
      </View>
      {children}
    </Card>
  );
}

/** Neon text that navigates. */
export function TextLink({ href, children }: { href: Href; children: ReactNode }) {
  return (
    <Link href={href} style={styles.link}>
      {children}
    </Link>
  );
}

/** The small neon line above a screen title ("Day log", a date). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

/** A dark text field matching the theme. */
export function Field({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.court500}
      keyboardAppearance="dark"
      style={[styles.field, props.multiline && styles.fieldMulti, style]}
      {...props}
    />
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

export function Loading({ title }: { title?: string }) {
  if (title) {
    return (
      <Screen title={title}>
        <ActivityIndicator color={colors.neon} style={{ marginTop: space.xxl }} />
      </Screen>
    );
  }
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.neon} />
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
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
  title: {
    color: colors.court100,
    fontFamily: fonts.heavy,
    fontSize: 40,
    textTransform: "uppercase",
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(7,9,13,0.92)",
  },
  card: {
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: space.lg,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: space.md,
  },
  sectionTitle: {
    color: colors.court100,
    fontFamily: fonts.display,
    fontSize: 19,
    letterSpacing: 1,
    textTransform: "uppercase",
    flexShrink: 1,
  },
  link: { color: colors.neon, fontSize: 14 },
  eyebrow: {
    color: colors.neon,
    fontSize: 13,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  field: {
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.court100,
    fontSize: 16,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  fieldMulti: { minHeight: 140, textAlignVertical: "top", lineHeight: 22 },
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

/** Shown where a page needs ratings the player doesn't have yet. */
export function NeedsRating() {
  return (
    <Screen>
      <Card style={{ gap: space.md, marginTop: space.xxl }}>
        <Text style={styles.sectionTitle}>Build your rating first</Text>
        <Muted>Daily logging moves ratings you don&apos;t have yet.</Muted>
        <TextLink href="/onboarding">Start onboarding →</TextLink>
      </Card>
    </Screen>
  );
}
