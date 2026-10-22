export interface HistoryDto {
  /** Consecutive local dates, oldest first. */
  dates: string[];
  /** Per rating node, its value on each date (null before it had one). */
  series: { nodeId: string; values: (number | null)[] }[];
}

export interface ActivityDayDto {
  date: string;
  /** Anything logged: journal, habit entry or answered question. */
  logged: boolean;
  recapped: boolean;
  /** Sum of rating increases that day (recaps), and of decreases (recaps and decay). */
  gain: number;
  loss: number;
}

/** 7-day change at or beyond which an attribute counts as hot (or, negated, cold). */
export const TREND_THRESHOLD = 1;
export const MAX_HISTORY_DAYS = 366;
