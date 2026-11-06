import { useRef, useState, type ReactNode } from "react";
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutRectangle,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, space } from "@/lib/theme";

export interface PopOption {
  label: string;
  onPress: () => void;
  /** Tints the label (a set kind's color). */
  color?: string;
  selected?: boolean;
  destructive?: boolean;
  /** Keeps the menu open (the option swaps in another page of options). */
  keepOpen?: boolean;
}

const WIDTH = 190;
const GAP = 6;

/**
 * A small menu that pops off the control that opened it: a column (or grid) of rectangular
 * options. Use with usePopAnchor, which measures the control.
 */
export function PopMenu({
  anchor,
  title,
  options,
  columns = 1,
  footer,
  onClose,
}: {
  anchor: LayoutRectangle | null;
  title?: string;
  options: PopOption[];
  columns?: number;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  if (!anchor) return null;

  // Below the control when it fits, otherwise above it; never off the edges.
  const below = anchor.y + anchor.height + GAP;
  const fitsBelow = below + height <= window.height - insets.bottom - space.md;
  const top = fitsBelow ? below : Math.max(insets.top + space.md, anchor.y - GAP - height);
  const left = Math.min(Math.max(space.md, anchor.x), window.width - WIDTH - space.md);
  // Inside the 1pt border and the padding.
  const cell = Math.floor((WIDTH - 2 - 2 * space.sm - (columns - 1) * GAP) / columns);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Close menu"
      />
      <View
        onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        style={[styles.menu, { top, left, opacity: height ? 1 : 0 }]}
        accessibilityViewIsModal
      >
        {title && (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        )}
        <View style={styles.grid}>
          {options.map((o) => (
            <Pressable
              key={o.label}
              onPress={() => {
                if (!o.keepOpen) onClose();
                o.onPress();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: o.selected }}
              style={({ pressed }) => [
                styles.option,
                { width: cell },
                o.selected && styles.selected,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  o.color ? { color: o.color } : null,
                  o.destructive && { color: colors.flare },
                  columns > 1 && { textAlign: "center" },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {footer}
      </View>
    </Modal>
  );
}

/**
 * A ref for the control that opens a PopMenu, and the measured rectangle to pop it from.
 * Opening first closes the keyboard, so the menu is placed against the settled layout.
 */
export function usePopAnchor() {
  const ref = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<LayoutRectangle | null>(null);
  const open = () => {
    const measure = () =>
      ref.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
    if (Keyboard.isVisible()) {
      const sub = Keyboard.addListener("keyboardDidHide", () => {
        sub.remove();
        measure();
      });
      Keyboard.dismiss();
    } else measure();
  };
  return { ref, anchor, open, close: () => setAnchor(null) };
}

const styles = StyleSheet.create({
  menu: {
    position: "absolute",
    width: WIDTH,
    padding: space.sm,
    gap: GAP,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.court700,
    backgroundColor: colors.court900,
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  title: {
    color: colors.court500,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    paddingHorizontal: 2,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  option: {
    backgroundColor: colors.court800,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.court700,
    paddingVertical: 9,
    paddingHorizontal: space.sm,
  },
  selected: { borderColor: colors.neonDim, backgroundColor: "rgba(60,242,200,0.10)" },
  label: { color: colors.court100, fontSize: 15, fontWeight: "500" },
});
