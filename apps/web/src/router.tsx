import { createBrowserRouter } from "react-router";
import { AuthPage, RequireAuth } from "./features/auth/AuthPage";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { HabitsPage } from "./features/habits/HabitsPage";
import { RatingsPage } from "./features/ratings/RatingsPage";
import { TodayPage } from "./features/today/TodayPage";
import { WeekPage } from "./features/week/WeekPage";
import { HomePage } from "./routes/HomePage";
import { NotFound } from "./routes/NotFound";
import { RootLayout } from "./routes/RootLayout";

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
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
            <RatingsPage />
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
      { path: "*", element: <NotFound /> },
    ],
  },
]);
