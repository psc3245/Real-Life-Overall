import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AuthPage, RequireAuth } from "./features/auth/AuthPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { HabitsPage } from "./features/habits/HabitsPage";
import { SeasonSetupPage } from "./features/seasons/SeasonSetupPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ProfilePage } from "./features/social/ProfilePage";
import { TodayPage } from "./features/today/TodayPage";
import { WeekPage } from "./features/week/WeekPage";
import { HomePage } from "./routes/HomePage";
import { NotFound } from "./routes/NotFound";
import { RootLayout } from "./routes/RootLayout";

// The ratings page carries the charting library; load it only when visited.
const RatingsPage = lazy(() =>
  import("./features/ratings/RatingsPage").then((m) => ({ default: m.RatingsPage })),
);
const loading = <p className="pt-10 text-court-500">Loading…</p>;

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "season-setup",
        element: (
          <RequireAuth>
            <SeasonSetupPage />
          </RequireAuth>
        ),
      },
      { path: "signin", element: <AuthPage mode="signin" /> },
      { path: "signup", element: <AuthPage mode="signup" /> },
      {
        path: "onboarding",
        element: (
          <RequireAuth>
            <OnboardingPage />
          </RequireAuth>
        ),
      },
      {
        path: "ratings",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <RatingsPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "today",
        element: (
          <RequireAuth>
            <TodayPage />
          </RequireAuth>
        ),
      },
      {
        path: "habits",
        element: (
          <RequireAuth>
            <HabitsPage />
          </RequireAuth>
        ),
      },
      {
        path: "week",
        element: (
          <RequireAuth>
            <WeekPage />
          </RequireAuth>
        ),
      },
      { path: "u/:username", element: <ProfilePage /> },
      {
        path: "settings",
        element: (
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
