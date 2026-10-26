import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { AuthPage, RequireAuth } from "./features/auth/AuthPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { AdminPage } from "./features/admin/AdminPage";
import { FeatureGate } from "./components/FeatureGate";
import { GoalsPage } from "./features/goals/GoalsPage";
import { ReportEditorPage } from "./features/reports/ReportEditorPage";
import { ReportsPage } from "./features/reports/ReportsPage";
import { ActiveWorkoutPage } from "./features/workouts/ActiveWorkoutPage";
import { ExercisesPage } from "./features/workouts/ExercisesPage";
import { StartWorkoutPage } from "./features/workouts/StartWorkoutPage";
import { TemplatePage } from "./features/workouts/TemplatePage";
import { WorkoutHistoryPage } from "./features/workouts/WorkoutHistoryPage";
import { WorkoutPage } from "./features/workouts/WorkoutPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { HabitsGlancePage } from "./features/habits/HabitsGlancePage";
import { ManageHabitsPage } from "./features/habits/ManageHabitsPage";
import { ScoutingReportPage } from "./features/scouting/ScoutingReportPage";
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
const ChartsPage = lazy(() =>
  import("./features/charts/ChartsPage").then((m) => ({ default: m.ChartsPage })),
);
const ReportPage = lazy(() =>
  import("./features/reports/ReportPage").then((m) => ({ default: m.ReportPage })),
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
            <FeatureGate feature="history">
              <HistoryPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "history/:id",
        element: (
          <RequireAuth>
            <FeatureGate feature="history">
              <Suspense fallback={loading}>
                <SeasonPage />
              </Suspense>
            </FeatureGate>
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
        path: "scouting-report",
        element: (
          <RequireAuth>
            <ScoutingReportPage />
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
            <FeatureGate feature="habits">
              <HabitsGlancePage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "habits/manage",
        element: (
          <RequireAuth>
            <FeatureGate feature="habits">
              <ManageHabitsPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "goals",
        element: (
          <RequireAuth>
            <FeatureGate feature="goals">
              <GoalsPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <StartWorkoutPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/active",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <ActiveWorkoutPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/history",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <WorkoutHistoryPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/templates/:id",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <TemplatePage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/exercises",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <ExercisesPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/exercises/:id",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <Suspense fallback={loading}>
                <ExercisePage />
              </Suspense>
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "workouts/:id",
        element: (
          <RequireAuth>
            <FeatureGate feature="workouts">
              <WorkoutPage />
            </FeatureGate>
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
            <FeatureGate feature="week">
              <WeekPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      { path: "u/:username", element: <ProfilePage /> },
      {
        path: "friends",
        element: (
          <RequireAuth>
            <FeatureGate feature="friends">
              <FriendsPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "leaderboards",
        element: (
          <RequireAuth>
            <FeatureGate feature="leaderboards">
              <LeaderboardsPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "compare/:username",
        element: (
          <RequireAuth>
            <FeatureGate feature="friends">
              <ComparePage />
            </FeatureGate>
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
      {
        path: "charts",
        element: (
          <RequireAuth>
            <FeatureGate feature="charts">
              <Suspense fallback={loading}>
                <ChartsPage />
              </Suspense>
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireAuth>
            <FeatureGate feature="reports">
              <ReportsPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "reports/new",
        element: (
          <RequireAuth>
            <FeatureGate feature="reports">
              <ReportEditorPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "reports/:id/edit",
        element: (
          <RequireAuth>
            <FeatureGate feature="reports">
              <ReportEditorPage />
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "reports/:id",
        element: (
          <RequireAuth>
            <FeatureGate feature="reports">
              <Suspense fallback={loading}>
                <ReportPage />
              </Suspense>
            </FeatureGate>
          </RequireAuth>
        ),
      },
      {
        path: "admin",
        element: (
          <RequireAuth>
            <AdminPage />
          </RequireAuth>
        ),
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
