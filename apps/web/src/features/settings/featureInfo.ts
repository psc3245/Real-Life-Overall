import type { Feature } from "@rlo/shared";

/** What each switchable part of the app is called and what turning it off hides. */
export const FEATURE_INFO: Record<Feature, { label: string; detail: string }> = {
  habits: {
    label: "Habits",
    detail:
      "Habit tracking: the Habits page, the habits section of the day log and its Today card.",
  },
  goals: {
    label: "Goals",
    detail: "Goals with a deadline: the Goals page, day-log entries and the Today card.",
  },
  workouts: {
    label: "Workouts",
    detail: "Set-by-set training: the Train pages, templates, records and the day log's workouts.",
  },
  journal: {
    label: "Journal",
    detail: "The free-form journal in the day log and its Today card.",
  },
  guidedPrompts: {
    label: "Guided questions",
    detail: "The model's questions at the top of each day's log.",
  },
  week: { label: "Week", detail: "The weekly breakdown and weekly reviews page." },
  friends: { label: "Friends", detail: "Friends, friend requests and side-by-side compare." },
  leaderboards: { label: "Leaderboards", detail: "Friends and global leaderboards." },
  charts: {
    label: "Charts",
    detail: "The chart explorer, saved and pinned charts, and chart links across the app.",
  },
  reports: { label: "Reports", detail: "Chart collections run over a period, with write-ups." },
  history: { label: "History", detail: "Past seasons and their archives." },
  focus: { label: "Focus card", detail: "The suggested focus areas on Today." },
  adaptiveRating: {
    label: "Adaptive rating",
    detail:
      "Weekly reviews tune your weights to your Scouting Report and now and then suggest " +
      "adding or removing part of your tree. Off keeps the tree as you set it.",
  },
};

/** How the configuration section groups the switches. */
export const FEATURE_GROUPS: { label: string; features: Feature[] }[] = [
  { label: "Daily logging", features: ["habits", "goals", "workouts", "journal", "guidedPrompts"] },
  { label: "Insights", features: ["week", "charts", "reports", "history", "focus"] },
  { label: "Social", features: ["friends", "leaderboards"] },
  { label: "Rating", features: ["adaptiveRating"] },
];
