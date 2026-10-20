import { createBrowserRouter } from "react-router";
import { OnboardingPage } from "./features/onboarding/OnboardingPage";
import { RatingsPage } from "./features/ratings/RatingsPage";
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
      { path: "*", element: <NotFound /> },
    ],
  },
]);
