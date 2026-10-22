import { createBrowserRouter } from "react-router";
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
      { path: "onboarding", element: <OnboardingPage /> },
      { path: "ratings", element: <RatingsPage /> },
      { path: "today", element: <TodayPage /> },
      { path: "habits", element: <HabitsPage /> },
      { path: "week", element: <WeekPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
