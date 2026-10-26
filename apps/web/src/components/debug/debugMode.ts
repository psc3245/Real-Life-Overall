import { useSyncExternalStore } from "react";
import { useIsAdmin } from "../../api/admin";

const KEY = "rlo.debug";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0"; // on by default for admins
  } catch {
    return true;
  }
}

let enabled = read();

export function setDebugMode(next: boolean) {
  enabled = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Storage unavailable: the choice lasts for this page load.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether the viewer's own debug switch is on (only matters for admins). */
export function useDebugSwitch() {
  return useSyncExternalStore(subscribe, () => enabled);
}

/** True when debug info should render: the viewer is an admin and debug mode is on. */
export function useDebug() {
  const admin = useIsAdmin();
  const on = useDebugSwitch();
  return admin && on;
}
