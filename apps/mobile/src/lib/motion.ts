import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { usePreferences } from "@/api/preferences";

/** Whether to skip animations: the player's Animations setting, else iOS Reduce Motion. */
export function useReducedMotion(): boolean {
  const { motion } = usePreferences();
  const [system, setSystem] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setSystem);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setSystem);
    return () => sub.remove();
  }, []);
  return motion === "off" || (motion === "system" && system);
}
