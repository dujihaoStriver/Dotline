export type TaskKind = "timed" | "all_day";

export type Task = {
  id: string;
  title: string;
  note: string;
  kind: TaskKind;
  /** Inclusive start day YYYY-MM-DD */
  startDate: string;
  /** Inclusive end day YYYY-MM-DD */
  endDate: string;
  /** Unique-ish accent color for this task */
  color: string;
  /** ISO datetime, timed tasks only (time-of-day on startDate) */
  startAt: string | null;
  /** ISO datetime, timed tasks only (time-of-day on endDate) */
  endAt: string | null;
  done: boolean;
  doneAt: string | null;
  carriedFrom: string | null;
  /** Smaller = higher priority (drawn / listed first) */
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type ReviewPeriod = "week" | "month" | "year";

export type Review = {
  id: string;
  period: ReviewPeriod;
  /** week: 2026-W42 · month: 2026-10 · year: 2026 */
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  content: string;
  insights: string;
  carryovers: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreSnapshot = {
  tasks: Task[];
  reviews: Review[];
};
