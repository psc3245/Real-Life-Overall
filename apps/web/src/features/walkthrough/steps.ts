import type { Feature, TalkTerms } from "@rlo/shared";
import { cap } from "../../lib/talk";

/**
 * One stop on the walkthrough. `to` is the page shown behind it; `target` names the element it
 * spotlights (a `data-tour` attribute). With no target, or when the target isn't on the page,
 * the card sits in the middle of the screen.
 */
export interface WalkthroughStep {
  id: string;
  title: string;
  body: string;
  to?: string;
  target?: string;
}

/** The pages each nav group opens, in nav order, so its stop shows the first one switched on. */
const GROUPS = {
  plan: [
    ["habits", "/habits"],
    ["goals", "/goals"],
    ["workouts", "/workouts"],
  ],
  social: [
    ["friends", "/friends"],
    ["leaderboards", "/leaderboards"],
  ],
  stats: [
    ["charts", "/charts"],
    ["reports", "/reports"],
    ["history", "/history"],
  ],
} satisfies Record<string, [Feature, string][]>;

/**
 * The tour of the main features, in the player's words. Stops for switched-off features (and
 * Premium ones on Free, which are off too) are left out.
 */
export function walkthroughSteps(
  talk: TalkTerms,
  features: Record<Feature, boolean>,
): WalkthroughStep[] {
  const first = (group: keyof typeof GROUPS) =>
    (GROUPS[group] as [Feature, string][]).find(([f]) => features[f])?.[1];
  const scout = cap(talk.scout);
  const steps: (WalkthroughStep | false)[] = [
    {
      id: "welcome",
      title: `The ${talk.walkthrough}`,
      body: `Your life, rated like a player. Here's a quick lap around the app: where your rating lives, how it moves and where to go next. Arrow keys work too.`,
    },
    {
      id: "rating",
      to: "/ratings",
      target: "nav-rating",
      title: `${talk.nav.rating}: your ${talk.playerCard.toLowerCase()}`,
      body: `Your ${talk.ovr}, rolled up from your categories and the attributes inside them. Open any attribute to see every move it's made and why.`,
    },
    {
      id: "today",
      to: "/today",
      target: "nav-today",
      title: `${talk.nav.today}: home base`,
      body: `Today's habits, goals, focus and recent moves in one place. Use Customize to choose what it shows.`,
    },
    {
      id: "log",
      to: "/log",
      target: "nav-log",
      title: `${talk.nav.log} the day`,
      body: `Write how the day went and check off your habits. This is the evidence ${talk.scout} rates you on, so the more honest and specific, the better.`,
    },
    {
      id: "recap",
      to: "/log",
      target: "recap",
      title: talk.endDay,
      body: `When you're done for the day, hit ${talk.endDay}. ${scout} reads your log and moves your ratings: up for the work you put in, down for setbacks. Missed a day? You can still fill it in and recap it afterwards.`,
    },
    features.week && {
      id: "week",
      to: "/week",
      target: "nav-week",
      title: talk.weeklyReview,
      body: `Once a week ${talk.scout} watches the whole week back, corrects anything the daily recaps over- or under-credited, and suggests what to work on next.`,
    },
    first("plan") !== undefined && {
      id: "plan",
      to: first("plan"),
      target: "nav-plan",
      title: talk.nav.plan,
      body: `Habits, goals and workouts. Link them to attributes and they count as evidence every time you check them off.`,
    },
    features.coach && {
      id: "coach",
      to: "/coach",
      target: "nav-coach",
      title: talk.coach,
      body: `${talk.coachTagline}. Ask about your ratings, your trends or what to do this week, and it can draft habits and goals for you.`,
    },
    first("social") !== undefined && {
      id: "social",
      to: first("social"),
      target: "nav-social",
      title: talk.nav.social,
      body: `Add friends, compare cards side by side and climb the boards. You choose what's shared in Settings.`,
    },
    first("stats") !== undefined && {
      id: "stats",
      to: first("stats"),
      target: "nav-stats",
      title: talk.nav.stats,
      body: `Chart any metric over time, build reports with write-ups and look back at past seasons.`,
    },
    {
      id: "account",
      target: "account-menu",
      title: "Make it yours",
      body: `Theme, which features show, how much sports talk you want: it's all under Personalize here. You can replay the ${talk.walkthrough.toLowerCase()} from this menu any time.`,
    },
  ];
  return steps.filter((s): s is WalkthroughStep => s !== false);
}
