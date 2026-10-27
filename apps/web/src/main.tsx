import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { cachedPreferences } from "./api/preferences";
import { applyAppearance } from "./lib/appearance";
import { router } from "./router";
import "./styles/index.css";

// Style the page from the last session's preferences before the first paint.
applyAppearance(cachedPreferences());

// Data is shared with the iOS app, so coming back to the tab always refetches what's on screen
// (a change made on the phone shows up at once); staleTime still keeps navigation snappy.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: "always" },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
