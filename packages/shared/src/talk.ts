import type { SeasonMode } from "./rating/growth";

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
  /** Souls mode (DESIGN.md §4.7): Souls words at normal and extra, plain words at none. */
  souls: {
    mode: string;
    /** The currency, and its singular. */
    souls: string;
    soul: string;
    /** The level-up screen. */
    bonfire: string;
    bonfireTagline: string;
    /** Overall's level, short. */
    level: string;
    levelUp: string;
    bloodstain: string;
    died: string;
    boss: string;
  };
  playerCard: string;
  profileHeading: string;
  archetype: string;
  /** Shown when there's no archetype yet. */
  unranked: string;
  /** Main menu links, plus the names of its dropdown groups (plan, social, stats). */
  nav: {
    today: string;
    log: string;
    week: string;
    habits: string;
    goals: string;
    workouts: string;
    friends: string;
    leaderboards: string;
    charts: string;
    reports: string;
    history: string;
    /** The big centered button: the rating page. */
    rating: string;
    plan: string;
    social: string;
    stats: string;
  };
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
    souls: {
      mode: "Levels",
      souls: "points",
      soul: "point",
      bonfire: "Level up",
      bonfireTagline: "Spend points on the stats you choose",
      level: "Level",
      levelUp: "Level up",
      bloodstain: "Dropped points",
      died: "Streak broken",
      boss: "Goal",
    },
    playerCard: "Summary card",
    profileHeading: "Profile",
    archetype: "Profile type",
    unranked: "No profile type yet",
    nav: {
      today: "Today",
      log: "Log",
      week: "Week",
      habits: "Habits",
      goals: "Goals",
      workouts: "Workouts",
      friends: "Friends",
      leaderboards: "Rankings",
      charts: "Charts",
      reports: "Reports",
      history: "History",
      rating: "Rating",
      plan: "Plan",
      social: "Social",
      stats: "Insights",
    },
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
    souls: {
      mode: "Souls",
      souls: "souls",
      soul: "soul",
      bonfire: "Bonfire",
      bonfireTagline: "Rest, spend your souls, level up",
      level: "SL",
      levelUp: "Level up",
      bloodstain: "Bloodstain",
      died: "You died",
      boss: "Boss",
    },
    playerCard: "Player card",
    profileHeading: "Player profile",
    archetype: "Archetype",
    unranked: "Unranked",
    nav: {
      today: "Today",
      log: "Log",
      week: "Week",
      habits: "Habits",
      goals: "Goals",
      workouts: "Train",
      friends: "Friends",
      leaderboards: "Leaders",
      charts: "Charts",
      reports: "Reports",
      history: "History",
      rating: "Rating",
      plan: "Playbook",
      social: "League",
      stats: "Stats",
    },
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
    souls: {
      mode: "Souls",
      souls: "souls",
      soul: "soul",
      bonfire: "Bonfire",
      bonfireTagline: "Rest, spend your souls, level up",
      level: "SL",
      levelUp: "Level up",
      bloodstain: "Bloodstain",
      died: "You died",
      boss: "Boss",
    },
    playerCard: "Player card",
    profileHeading: "Player profile",
    archetype: "Build",
    unranked: "Undrafted",
    nav: {
      today: "Game day",
      log: "Log",
      week: "Film room",
      habits: "Habits",
      goals: "Goals",
      workouts: "Practice",
      friends: "Friends",
      leaderboards: "Standings",
      charts: "Charts",
      reports: "Reports",
      history: "History",
      rating: "Rating",
      plan: "Playbook",
      social: "Clubhouse",
      stats: "Stat sheet",
    },
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

/**
 * A Souls season's words (DESIGN.md §4.7): the game's own vocabulary where it has one (Status,
 * Level Up, Rest, Equipment, Covenant, Phantoms, Class, Hollow, Firekeeper) and grim plain words
 * where it doesn't. Replaces normal and extra sports talk for the season; none stays plain.
 */
export const SOULS_TALK: TalkTerms = {
  scout: "the Firekeeper",
  Scout: "Firekeeper",
  scoutingReport: "Oath",
  scoutingReportTagline: "What you've sworn to pursue",
  coach: "Firekeeper",
  coachTagline: "Rest a while, and ask",
  ovr: "SL",
  growthMode: "Most Improved",
  growthLabel: "Growth",
  ratingMode: "OVR",
  souls: {
    mode: "Souls",
    souls: "souls",
    soul: "soul",
    bonfire: "Level Up",
    bonfireTagline: "Spend your souls on the stats you choose",
    level: "SL",
    levelUp: "Level up",
    bloodstain: "Bloodstain",
    died: "You died",
    boss: "Boss",
  },
  playerCard: "Status",
  profileHeading: "Status",
  archetype: "Class",
  unranked: "Hollow",
  nav: {
    today: "Bonfire",
    log: "Chronicle",
    week: "Journey",
    habits: "Vows",
    goals: "Bosses",
    workouts: "Training",
    friends: "Phantoms",
    leaderboards: "Ranks",
    charts: "Charts",
    reports: "Tomes",
    history: "Cycles",
    rating: "Status",
    plan: "Equipment",
    social: "Covenant",
    stats: "Archives",
  },
  todayEyebrow: "Bonfire",
  weeklyReview: "The week's reckoning",
  runWeekly: "Reckon the week",
  endDay: "Rest",
  scouting: "Character creation",
  startScouting: "Create your character",
  reveal: "Awakening",
  revealButton: "Awaken",
};

/** The app's words for a sports-talk level in a season of `mode`. */
export function talkFor(talk: SportsTalk, mode: SeasonMode | null | undefined): TalkTerms {
  return mode === "souls" && talk !== "none" ? SOULS_TALK : TALK[talk];
}
