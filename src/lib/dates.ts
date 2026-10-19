/** Monday-start week helpers, using local calendar (Asia/Shanghai on your machine). */

const DAY_MS = 24 * 60 * 60 * 1000;

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

export function endOfWeekSunday(date: Date): Date {
  return addDays(startOfWeekMonday(date), 6);
}

/** ISO-like week key with Monday start: 2026-W42 */
export function getWeekKey(date: Date): string {
  const monday = startOfWeekMonday(date);
  const thursday = addDays(monday, 3);
  const year = thursday.getFullYear();
  const yearStart = new Date(year, 0, 1, 12);
  const yearStartMonday = startOfWeekMonday(yearStart);
  const week =
    Math.floor((monday.getTime() - yearStartMonday.getTime()) / (7 * DAY_MS)) +
    1;
  return `${year}-W${pad2(week)}`;
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function getYearKey(date: Date): string {
  return `${date.getFullYear()}`;
}

export function weekRangeFromKey(weekKey: string): {
  start: string;
  end: string;
} {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) {
    const today = new Date();
    return {
      start: toDateKey(startOfWeekMonday(today)),
      end: toDateKey(endOfWeekSunday(today)),
    };
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(year, 0, 4, 12);
  const week1Monday = startOfWeekMonday(jan4);
  const monday = addDays(week1Monday, (week - 1) * 7);
  return {
    start: toDateKey(monday),
    end: toDateKey(addDays(monday, 6)),
  };
}

export function monthRangeFromKey(monthKey: string): {
  start: string;
  end: string;
} {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 12);
  const end = new Date(y, m, 0, 12);
  return { start: toDateKey(start), end: toDateKey(end) };
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function yearRangeFromKey(yearKey: string): {
  start: string;
  end: string;
} {
  const y = Number(yearKey);
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
  };
}

export function formatShortDate(dateKey: string): string {
  const d = parseDateKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatWeekLabel(weekKey: string): string {
  const { start, end } = weekRangeFromKey(weekKey);
  return `${weekKey}（${formatShortDate(start)} – ${formatShortDate(end)}）`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function combineDateAndTime(dateKey: string, time: string): string {
  const [h, m] = time.split(":").map(Number);
  const d = parseDateKey(dateKey);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toISOString();
}

export function eachDateKey(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

export function shiftDateKey(dateKey: string, days: number): string {
  return toDateKey(addDays(parseDateKey(dateKey), days));
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12);
  return getMonthKey(d);
}

export function weekdayLabel(dateKey: string): string {
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  return `周${labels[parseDateKey(dateKey).getDay()]}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  return `${y}年${Number(m)}月`;
}

export function monthKeysInYear(yearKey: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${yearKey}-${pad2(i + 1)}`);
}

export function shortMonthLabel(monthKey: string): string {
  const m = Number(monthKey.split("-")[1]);
  return `${m}月`;
}

/** Weeks whose date range overlaps the given month (Monday-start). */
export function weeksOverlappingMonth(monthKey: string): {
  weekKey: string;
  start: string;
  end: string;
  /** Days of this week that fall inside the month */
  daysInMonth: string[];
}[] {
  const { start, end } = monthRangeFromKey(monthKey);
  const seen = new Set<string>();
  const weeks: {
    weekKey: string;
    start: string;
    end: string;
    daysInMonth: string[];
  }[] = [];

  for (const day of eachDateKey(start, end)) {
    const weekKey = getWeekKey(parseDateKey(day));
    if (seen.has(weekKey)) continue;
    seen.add(weekKey);
    const range = weekRangeFromKey(weekKey);
    const daysInMonth = eachDateKey(range.start, range.end).filter(
      (d) => d >= start && d <= end,
    );
    weeks.push({ weekKey, start: range.start, end: range.end, daysInMonth });
  }
  return weeks;
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

export function formatDateRange(start: string, end: string): string {
  if (start === end) return formatShortDate(start);
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}
