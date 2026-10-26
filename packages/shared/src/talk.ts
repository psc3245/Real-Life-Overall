/**
 * Sports talk (DESIGN.md §7.10): how much sports framing the app uses, in its own words and in
 * everything the model writes. "normal" is the app's default voice; "none" is plain and
 * numbers-first; "extra" goes full broadcast booth.
 */
export const SPORTS_TALK_LEVELS = ["none", "normal", "extra"] as const;
export type SportsTalk = (typeof SPORTS_TALK_LEVELS)[number];

export const SPORTS_TALK_INFO: Record<SportsTalk, { label: string; detail: string }> = {
  none: {
    label: "None",
    detail: "Plain language: ratings, numbers and trends, no game talk.",
  },
  normal: {
    label: "Normal",
    detail: "The 2K-style framing: a scout, a coach, a player card.",
  },
  extra: {
    label: "Extra",
    detail: "Full broadcast booth: game days, film sessions and a scout who talks like one.",
  },
};

/** The app's own words that change with the setting. */
export interface TalkTerms {
  /** The model, as the app refers to it ("the scout"). */
  scout: string;
  Scout: string;
  scoutingReport: string;
  scoutingReportTagline: string;
  coach: string;
  coachTagline: string;
  /** The OVR number's short label. */
  ovr: string;
  /** Growth mode's name (DESIGN.md §4.6), and its number's short label. */
  growthMode: string;
  growthLabel: string;
  /** Rating mode's name. */
  ratingMode: string;
  playerCard: string;
  profileHeading: string;
  archetype: string;
  /** Shown when there's no archetype yet. */
  unranked: string;
  nav: { today: string; week: string; workouts: string; leaderboards: string };
  todayEyebrow: string;
  weeklyReview: string;
  runWeekly: string;
  endDay: string;
  /** Onboarding's questionnaire step and the reveal. */
  scouting: string;
  startScouting: string;
  reveal: string;
  revealButton: string;
}

export const TALK: Record<SportsTalk, TalkTerms> = {
  none: {
    scout: "the AI",
    Scout: "AI",
    scoutingReport: "Life priorities",
    scoutingReportTagline: "What matters to you",
    coach: "Assistant",
    coachTagline: "Ask anything about your data",
    ovr: "Overall",
    growthMode: "Growth",
    growthLabel: "Gained",
    ratingMode: "Rating",
    playerCard: "Summary card",
    profileHeading: "Profile",
    archetype: "Profile type",
    unranked: "No profile type yet",
    nav: { today: "Today", week: "Week", workouts: "Workouts", leaderboards: "Rankings" },
    todayEyebrow: "",
    weeklyReview: "Weekly review",
    runWeekly: "Run weekly review",
    endDay: "End my day",
    scouting: "Questions",
    startScouting: "Start the questions",
    reveal: "Results",
    revealButton: "Show my rating",
  },
  normal: {
    scout: "the scout",
    Scout: "Scout",
    scoutingReport: "Scouting Report",
    scoutingReportTagline: "What you're playing for",
    coach: "Coach",
    coachTagline: "Your scout, on call",
    ovr: "OVR",
    growthMode: "Most Improved",
    growthLabel: "Growth",
    ratingMode: "OVR",
    playerCard: "Player card",
    profileHeading: "Player profile",
    archetype: "Archetype",
    unranked: "Unranked",
    nav: { today: "Today", week: "Week", workouts: "Train", leaderboards: "Leaders" },
    todayEyebrow: "",
    weeklyReview: "Weekly review",
    runWeekly: "Run weekly review",
    endDay: "End my day",
    scouting: "Scouting",
    startScouting: "Start scouting",
    reveal: "Reveal",
    revealButton: "Reveal my rating",
  },
  extra: {
    scout: "your scout",
    Scout: "Scout",
    scoutingReport: "Scouting Report",
    scoutingReportTagline: "The front office file on you",
    coach: "Coach",
    coachTagline: "Coach is in the building",
    ovr: "OVR",
    growthMode: "MIP race",
    growthLabel: "MIP",
    ratingMode: "OVR race",
    playerCard: "Player card",
    profileHeading: "Player profile",
    archetype: "Build",
    unranked: "Undrafted",
    nav: { today: "Game day", week: "Film room", workouts: "Practice", leaderboards: "Standings" },
    todayEyebrow: "Game day",
    weeklyReview: "Film session",
    runWeekly: "Roll the tape",
    endDay: "Final whistle",
    scouting: "Combine",
    startScouting: "Hit the combine",
    reveal: "Draft night",
    revealButton: "Reveal my rating",
  },
};
