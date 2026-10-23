import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { colors, fonts } from "./theme";

/**
 * Each tab's stack. Tab roots draw their own title (Screen's `title`): the native large title
 * only showed on the first tab under native tabs. Pushed screens get a regular header.
 */
export const tabStackOptions: ComponentProps<typeof Stack>["screenOptions"] = {
  headerTitleStyle: { fontFamily: fonts.display, color: colors.court100 },
  headerStyle: { backgroundColor: colors.court950 },
  headerTintColor: colors.neon,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.court950 },
};
