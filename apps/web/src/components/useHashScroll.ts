import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Scrolls to the element named by the URL hash once `ready` (the page's data has rendered).
 * React Router doesn't do this for client-side navigation.
 */
export function useHashScroll(ready: boolean) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ready, hash]);
}
