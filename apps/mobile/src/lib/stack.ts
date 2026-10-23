import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { colors, fonts } from "./theme";

/** Native large-title headers for each tab's stack. */
export const tabStackOptions: ComponentProps<typeof Stack>["screenOptions"] = {
  headerLargeTitle: true,
  headerTransparent: true,
  headerBlurEffect: "systemChromeMaterialDark",
  headerLargeTitleStyle: { fontFamily: fonts.heavy, color: colors.court100 },
  headerTitleStyle: { fontFamily: fonts.display, color: colors.court100 },
  headerTintColor: colors.neon,
  contentStyle: { backgroundColor: colors.court950 },
};
