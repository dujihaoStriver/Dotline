import {
  eachDateKey,
  formatDateRange,
  formatShortDate,
  formatTime,
  formatWeekLabel,
  getWeekKey,
  monthRangeFromKey,
  parseDateKey,
  rangesOverlap,
  weekRangeFromKey,
  yearRangeFromKey,
} from "./dates";
import type { Review, Task } from "./types";

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // 未完成在前，已完成/已结转留底沉底
    const inactiveA = a.done || Boolean(a.carriedTo);
    const inactiveB = b.done || Boolean(b.carriedTo);
    if (inactiveA !== inactiveB) return inactiveA ? 1 : -1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.kind === "timed" && b.kind === "timed") {
      return (a.startAt ?? "").localeCompare(b.startAt ?? "");
    }
    if (a.kind === "timed") return -1;
    if (b.kind === "timed") return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function formatTaskLine(task: Task): string {
  const mark = task.done ? "x" : task.carriedTo ? "→" : " ";
  const suffix = task.carriedTo ? `（已结转到 ${task.carriedTo}）` : "";
  const days = formatDateRange(task.startDate, task.endDate);
  if (task.kind === "timed") {
    const range = `${formatTime(task.startAt)}–${formatTime(task.endAt)}`;
    return `- [${mark}] ${days} ${range} ${task.title}${suffix}`;
  }
  return `- [${mark}] ${days} ${task.title}${suffix}`;
}

export function taskOverlapsRange(
  task: Task,
  start: string,
  end: string,
): boolean {
  return rangesOverlap(task.startDate, task.endDate, start, end);
}

export function taskOnDay(task: Task, day: string): boolean {
  return task.startDate <= day && task.endDate >= day;
}

/** 结束日晚于开始日 → 长期/跨日任务 */
export function isMultiDayTask(task: Task): boolean {
  return task.startDate !== task.endDate;
}

export function tasksInRange(
  tasks: Task[],
  start: string,
  end: string,
): Task[] {
  return sortTasks(tasks.filter((t) => taskOverlapsRange(t, start, end)));
}

export function tasksOnDay(tasks: Task[], day: string): Task[] {
  return sortTasks(tasks.filter((t) => taskOnDay(t, day)));
}

/** 拆成当日任务与覆盖该日的长期（跨日）任务 */
export function splitDayTasks(
  tasks: Task[],
  day: string,
): { dayTasks: Task[]; longTasks: Task[] } {
  const onDay = tasksOnDay(tasks, day);
  return {
    dayTasks: onDay.filter((t) => !isMultiDayTask(t)),
    longTasks: onDay.filter(isMultiDayTask),
  };
}

type DraftSeed = Pick<Review, "insights" | "carryovers"> | undefined;

export function buildWeekDraft(
  tasks: Task[],
  weekKey: string,
  existing?: DraftSeed,
): { content: string; insights: string; carryovers: string } {
  const { start, end } = weekRangeFromKey(weekKey);
  const inWeek = tasksInRange(tasks, start, end);
  const done = inWeek.filter((t) => t.done);
  const open = inWeek.filter((t) => !t.done && !t.carriedTo);

  const insights = existing?.insights ?? "";
  const carryovers =
    existing?.carryovers ||
    open
      .map((t) => `- [ ] ${t.title}（${formatDateRange(t.startDate, t.endDate)}）`)
      .join("\n");

  const content = [
    `# 周总结 ${formatWeekLabel(weekKey)}`,
    "",
    `统计区间：${start} → ${end}`,
    `完成 ${done.length} / 共 ${inWeek.length} 项`,
    "",
    "## 本周完成",
    done.length ? done.map(formatTaskLine).join("\n") : "_本周尚无已完成任务_",
    "",
    "## 未完成 / 结转",
    carryovers || "_无_",
    "",
    "## 本周心得",
    insights || "",
    "",
  ].join("\n");

  return { content, insights, carryovers };
}

export function buildMonthDraft(
  tasks: Task[],
  reviews: Review[],
  monthKey: string,
  existing?: DraftSeed,
): { content: string; insights: string; carryovers: string } {
  const { start, end } = monthRangeFromKey(monthKey);
  const inMonth = tasksInRange(tasks, start, end);
  const done = inMonth.filter((t) => t.done);
  const open = inMonth.filter((t) => !t.done && !t.carriedTo);

  const weekKeys = new Set(
    eachDateKey(start, end).map((d) => getWeekKey(parseDateKey(d))),
  );
  const weekReviews = reviews
    .filter((r) => r.period === "week" && weekKeys.has(r.periodKey))
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  const weekDigest = weekReviews.length
    ? weekReviews
        .map((r) => {
          const insight = r.insights.trim() || "_（未写心得）_";
          const carry = r.carryovers.trim() || "_（无结转）_";
          return [
            `### ${formatWeekLabel(r.periodKey)}`,
            "",
            "**心得**",
            insight,
            "",
            "**结转**",
            carry,
            "",
          ].join("\n");
        })
        .join("\n")
    : "_本月尚无已保存的周总结_";

  const insights = existing?.insights ?? "";
  const carryovers =
    existing?.carryovers ||
    open
      .slice(0, 30)
      .map((t) => `- [ ] ${t.title}（${formatDateRange(t.startDate, t.endDate)}）`)
      .join("\n");

  const content = [
    `# 月总结 ${monthKey}`,
    "",
    `统计区间：${start} → ${end}`,
    `完成 ${done.length} / 共 ${inMonth.length} 项`,
    "",
    "## 本月任务完成摘录",
    done.length
      ? done
          .slice(0, 80)
          .map(formatTaskLine)
          .join("\n") +
        (done.length > 80 ? `\n\n_…另有 ${done.length - 80} 项已省略_` : "")
      : "_本月尚无已完成任务_",
    "",
    "## 各周心得 / 结转",
    weekDigest,
    "",
    "## 未完成结转",
    carryovers || "_无_",
    "",
    "## 本月心得",
    insights || "",
    "",
  ].join("\n");

  return { content, insights, carryovers };
}

export function buildYearDraft(
  tasks: Task[],
  reviews: Review[],
  yearKey: string,
  existing?: DraftSeed,
): { content: string; insights: string; carryovers: string } {
  const { start, end } = yearRangeFromKey(yearKey);
  const inYear = tasksInRange(tasks, start, end);
  const done = inYear.filter((t) => t.done);

  const monthReviews = reviews
    .filter(
      (r) => r.period === "month" && r.periodKey.startsWith(`${yearKey}-`),
    )
    .sort((a, b) => a.periodKey.localeCompare(b.periodKey));

  const monthDigest = monthReviews.length
    ? monthReviews
        .map((r) => {
          const insight = r.insights.trim() || "_（未写心得）_";
          return [`### ${r.periodKey}`, "", insight, ""].join("\n");
        })
        .join("\n")
    : "_本年尚无已保存的月总结_";

  const byMonth = new Map<string, { total: number; done: number }>();
  for (const t of inYear) {
    const key = t.startDate.slice(0, 7);
    const cur = byMonth.get(key) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.done) cur.done += 1;
    byMonth.set(key, cur);
  }
  const monthStats = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `- ${k}：完成 ${v.done} / ${v.total}`)
    .join("\n");

  const insights = existing?.insights ?? "";
  const carryovers = existing?.carryovers ?? "";

  const content = [
    `# 年总结 ${yearKey}`,
    "",
    `统计区间：${start} → ${end}`,
    `全年完成 ${done.length} / 共 ${inYear.length} 项`,
    "",
    "## 各月完成概况",
    monthStats || "_无任务数据_",
    "",
    "## 各月心得摘录",
    monthDigest,
    "",
    "## 未竟之事 / 跨年结转",
    carryovers || "",
    "",
    "## 本年心得",
    insights || "",
    "",
  ].join("\n");

  return { content, insights, carryovers };
}

export function rebuildContent(
  period: Review["period"],
  periodKey: string,
  insights: string,
  carryovers: string,
  headerAndBody: string,
): string {
  void period;
  void periodKey;
  const withoutTail = headerAndBody
    .replace(/\n## 未完成[^\n]*\n[\s\S]*?(?=\n## 本[周月年]心得|\n## 本年心得|$)/, "")
    .replace(/\n## 未竟之事[^\n]*\n[\s\S]*?(?=\n## 本年心得|$)/, "")
    .replace(/\n## 本[周月年]心得\n[\s\S]*$/, "")
    .replace(/\n## 本年心得\n[\s\S]*$/, "")
    .trimEnd();

  if (period === "year") {
    return [
      withoutTail,
      "",
      "## 未竟之事 / 跨年结转",
      carryovers || "",
      "",
      "## 本年心得",
      insights || "",
      "",
    ].join("\n");
  }

  const carryTitle = period === "week" ? "## 未完成 / 结转" : "## 未完成结转";
  const insightTitle =
    period === "week" ? "## 本周心得" : period === "month" ? "## 本月心得" : "## 本年心得";

  return [
    withoutTail,
    "",
    carryTitle,
    carryovers || "_无_",
    "",
    insightTitle,
    insights || "",
    "",
  ].join("\n");
}

export { formatShortDate };
