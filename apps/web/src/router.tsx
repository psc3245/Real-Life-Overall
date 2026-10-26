import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AuthPage, RequireAuth } from "./features/auth/AuthPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { GoalsPage } from "./features/goals/GoalsPage";
import { ActiveWorkoutPage } from "./features/workouts/ActiveWorkoutPage";
import { ExercisesPage } from "./features/workouts/ExercisesPage";
import { StartWorkoutPage } from "./features/workouts/StartWorkoutPage";
import { TemplatePage } from "./features/workouts/TemplatePage";
import { WorkoutHistoryPage } from "./features/workouts/WorkoutHistoryPage";
import { WorkoutPage } from "./features/workouts/WorkoutPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { HabitsGlancePage } from "./features/habits/HabitsGlancePage";
import { ManageHabitsPage } from "./features/habits/ManageHabitsPage";
import { SeasonSetupPage } from "./features/seasons/SeasonSetupPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { ComparePage } from "./features/social/ComparePage";
import { FriendsPage } from "./features/social/FriendsPage";
import { LeaderboardsPage } from "./features/social/LeaderboardsPage";
import { ProfilePage } from "./features/social/ProfilePage";
import { LogPage } from "./features/today/LogPage";
import { TodayPage } from "./features/today/TodayPage";
import { WeekPage } from "./features/week/WeekPage";
import { HomePage } from "./routes/HomePage";
import { NotFound } from "./routes/NotFound";
import { RootLayout } from "./routes/RootLayout";

// The ratings page carries the charting library; load it only when visited.
const ActivityPage = lazy(() =>
  import("./features/ratings/ActivityPage").then((m) => ({ default: m.ActivityPage })),
);
const NodePage = lazy(() =>
  import("./features/ratings/NodePage").then((m) => ({ default: m.NodePage })),
);
const SeasonPage = lazy(() =>
  import("./features/history/SeasonPage").then((m) => ({ default: m.SeasonPage })),
);
const RatingsPage = lazy(() =>
  import("./features/ratings/RatingsPage").then((m) => ({ default: m.RatingsPage })),
);
const ExercisePage = lazy(() =>
  import("./features/workouts/ExercisePage").then((m) => ({ default: m.ExercisePage })),
);
const BodyPage = lazy(() =>
  import("./features/body/BodyPage").then((m) => ({ default: m.BodyPage })),
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
        path: "history",
        element: (
          <RequireAuth>
            <HistoryPage />
          </RequireAuth>
        ),
      },
      {
        path: "history/:id",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <SeasonPage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "ratings/node/:id",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <NodePage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "ratings/activity",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <ActivityPage />
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
        path: "log",
        element: (
          <RequireAuth>
            <LogPage />
          </RequireAuth>
        ),
      },
      {
        path: "habits",
        element: (
          <RequireAuth>
            <HabitsGlancePage />
          </RequireAuth>
        ),
      },
      {
        path: "habits/manage",
        element: (
          <RequireAuth>
            <ManageHabitsPage />
          </RequireAuth>
        ),
      },
      {
        path: "goals",
        element: (
          <RequireAuth>
            <GoalsPage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts",
        element: (
          <RequireAuth>
            <StartWorkoutPage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts/active",
        element: (
          <RequireAuth>
            <ActiveWorkoutPage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts/history",
        element: (
          <RequireAuth>
            <WorkoutHistoryPage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts/templates/:id",
        element: (
          <RequireAuth>
            <TemplatePage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts/exercises",
        element: (
          <RequireAuth>
            <ExercisesPage />
          </RequireAuth>
        ),
      },
      {
        path: "workouts/exercises/:id",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <ExercisePage />
            </Suspense>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/:id",
        element: (
          <RequireAuth>
            <WorkoutPage />
          </RequireAuth>
        ),
      },
      {
        path: "body",
        element: (
          <RequireAuth>
            <Suspense fallback={loading}>
              <BodyPage />
            </Suspense>
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
        path: "friends",
        element: (
          <RequireAuth>
            <FriendsPage />
          </RequireAuth>
        ),
      },
      {
        path: "leaderboards",
        element: (
          <RequireAuth>
            <LeaderboardsPage />
          </RequireAuth>
        ),
      },
      {
        path: "compare/:username",
        element: (
          <RequireAuth>
            <ComparePage />
          </RequireAuth>
        ),
      },
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
