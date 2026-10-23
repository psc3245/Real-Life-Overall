import type { ComponentProps } from "react";
import type { Stack } from "expo-router";
import { colors, fonts } from "./theme";

// The object form of a screen's options (not the function form).
type Options = Exclude<
  ComponentProps<typeof Stack.Screen>["options"],
  ((...args: never[]) => unknown) | undefined
>;

/**
 * Each tab's stack. Tab roots draw their own title (Screen's `title`): the native large title
 * only showed on the first tab under native tabs.
 */
export const tabStackOptions: Options = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.court950 },
};

/** Screens pushed over the tabs (a day's log, an attribute page…): a plain dark header. */
export const pushedOptions: Options = {
  headerShown: true,
  title: "",
  headerTitleStyle: { fontFamily: fonts.display, color: colors.court100 },
  headerStyle: { backgroundColor: colors.court950 },
  headerTintColor: colors.neon,
  headerShadowVisible: false,
  headerBackButtonDisplayMode: "minimal",
  contentStyle: { backgroundColor: colors.court950 },
};
