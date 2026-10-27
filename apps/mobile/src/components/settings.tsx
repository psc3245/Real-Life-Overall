import { router, type Href } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSaveStatus } from "@/api/preferences";
import { colors, fonts, space } from "@/lib/theme";
import { Label, Muted } from "./ui";

/** An iOS-style inset group: a small heading, rows in one card, and an optional footnote. */
export function SettingsGroup({
  title,
  footer,
  action,
  children,
}: {
  title?: string;
  footer?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      {(title || action) && (
        <View style={styles.groupHead}>
          {title ? <Label>{title}</Label> : <View />}
          {action}
        </View>
      )}
      <View style={styles.group}>{children}</View>
      {footer && <Muted style={styles.footer}>{footer}</Muted>}
    </View>
  );
}

/** A row with a label (and detail) on the left and a control on the right or below. */
export function SettingRow({
  label,
  detail,
  children,
  stacked,
  last,
}: {
  label: string;
  detail?: ReactNode;
  children?: ReactNode;
  /** Put the control under the label (wide controls). */
  stacked?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, stacked && styles.stacked, !last && styles.border]}>
      <View style={{ flex: stacked ? undefined : 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Muted style={styles.detail}>{detail}</Muted> : null}
      </View>
      {children}
    </View>
  );
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
  disabled,
  last,
}: {
  label: string;
  detail?: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <SettingRow label={label} detail={detail} last={last}>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ true: colors.neonDim }}
        thumbColor={colors.court100}
      />
    </SettingRow>
  );
}

/** A row that opens another screen. */
export function NavRow({
  icon,
  label,
  detail,
  href,
  onPress,
  badge = 0,
  last,
}: {
  icon?: SymbolViewProps["name"];
  label: string;
  detail?: string;
  href?: Href;
  onPress?: () => void;
  badge?: number;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { opacity: 0.6 }]}
    >
      {icon && <SymbolView name={icon} tintColor={colors.neon} size={20} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Muted style={styles.detail}>{detail}</Muted> : null}
      </View>
      {badge > 0 && (
        <View style={styles.badge} accessibilityLabel={`${badge} pending`}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <SymbolView name="chevron.right" tintColor={colors.court500} size={14} />
    </Pressable>
  );
}

/** "Saving…" / "Saved" for preference edits (they save on their own). */
export function SaveStatus() {
  const status = useSaveStatus();
  if (status === "idle") return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.status, status === "error" && { color: colors.flare }]}
    >
      {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Couldn't save"}
    </Text>
  );
}

const styles = StyleSheet.create({
  groupHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  group: {
    backgroundColor: colors.court900,
    borderColor: colors.court700,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    overflow: "hidden",
  },
  footer: { fontSize: 12, color: colors.court500, paddingHorizontal: space.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 12,
    minHeight: 50,
  },
  stacked: { flexDirection: "column", alignItems: "stretch", gap: space.sm },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.court800 },
  label: { color: colors.court100, fontSize: 16 },
  detail: { fontSize: 13, color: colors.court500 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.flare,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.court100, fontFamily: fonts.display, fontSize: 13 },
  status: { color: colors.court500, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
});
