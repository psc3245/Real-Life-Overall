import type { Feature, TodayWidget } from "@rlo/shared";

/** What each switchable part of the app is called and what turning it off hides (as on the web). */
export const FEATURE_INFO: Record<Feature, { label: string; detail: string }> = {
  habits: {
    label: "Habits",
    detail:
      "Habit tracking: the Habits view, the habits section of the day log and its Today card.",
  },
  goals: {
    label: "Goals",
    detail: "Goals with a deadline: the Goals view, day-log entries and the Today card.",
  },
  workouts: {
    label: "Workouts",
    detail: "Set-by-set training: the Train view, templates, records and the day log's workouts.",
  },
  journal: { label: "Journal", detail: "The free-form journal in the day log and its Today card." },
  guidedPrompts: {
    label: "Guided questions",
    detail: "The model's questions at the top of each day's log.",
  },
  week: { label: "Week", detail: "The weekly breakdown and weekly reviews tab." },
  friends: { label: "Friends", detail: "Friends, friend requests and side-by-side compare." },
  leaderboards: { label: "Leaderboards", detail: "Friends and global leaderboards." },
  charts: {
    label: "Charts",
    detail: "The chart explorer, saved and pinned charts, and chart links across the app.",
  },
  reports: { label: "Reports", detail: "Chart collections run over a period, with write-ups." },
  history: { label: "History", detail: "Past seasons and their archives." },
  focus: { label: "Focus card", detail: "The suggested focus areas on Today." },
  coach: {
    label: "Coach",
    detail: "The coach chat, its Today card and one-tap habit, goal and report suggestions.",
  },
  adaptiveRating: {
    label: "Adaptive rating",
    detail:
      "Weekly reviews tune your weights to your Scouting Report and now and then suggest " +
      "adding or removing part of your tree. Off keeps the tree as you set it.",
  },
};

export const FEATURE_GROUPS: { label: string; features: Feature[] }[] = [
  { label: "Daily logging", features: ["habits", "goals", "workouts", "journal", "guidedPrompts"] },
  { label: "Insights", features: ["week", "coach", "charts", "reports", "history", "focus"] },
  { label: "Social", features: ["friends", "leaderboards"] },
  { label: "Rating", features: ["adaptiveRating"] },
];

export const WIDGET_INFO: Record<TodayWidget, { label: string; detail: string }> = {
  missed: { label: "Missed recaps", detail: "A reminder when a logged day hasn't been recapped." },
  habits: { label: "Habits", detail: "Today's scheduled habits and how many are done." },
  rating: { label: "Your rating", detail: "Overall, its 7-day trend and the hottest movers." },
  goals: { label: "Goals", detail: "Running goals with progress and pace." },
  journal: { label: "Journal", detail: "A peek at today's entry and guided questions." },
  training: { label: "Training", detail: "Today's workouts and a shortcut to start one." },
  charts: { label: "Pinned charts", detail: "Charts you've pinned in the chart explorer." },
  focus: { label: "Focus", detail: "Suggested areas to work on." },
  coach: { label: "Coach", detail: "Ask the coach a question, or start from a suggestion." },
  recap: { label: "Recap", detail: "Today's recap, or yesterday's until you end the day." },
};
