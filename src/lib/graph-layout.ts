import {
  daysInMonth,
  formatShortDate,
  monthKeysInYear,
  monthRangeFromKey,
  shortMonthLabel,
  weekdayLabel,
  weeksOverlappingMonth,
} from "./dates";
import { taskOnDay, tasksInRange, tasksOnDay } from "./review-draft";
import type { Task } from "./types";

export type GraphKind = "year" | "month" | "week" | "day" | "task";

export type GraphNode = {
  id: string;
  kind: GraphKind;
  x: number;
  y: number;
  r: number;
  label: string;
  sublabel: string;
  color: string;
  done?: boolean;
  monthKey?: string;
  weekKey?: string;
  day?: string;
  taskId?: string;
  expandable?: boolean;
  expanded?: boolean;
  taskCount?: number;
  multiDay?: boolean;
  /** Day circle filled with a multi-day task color */
  filled?: boolean;
  /** Colored dots on a collapsed week/month that hide a multi-day task */
  hintColors?: string[];
  priority?: number;
  /** 1-based order among incomplete tasks on that day; omitted when done */
  seq?: number;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  color: string;
};

/** Rounded box grouping the days a multi-day task covers */
export type GraphFrame = {
  id: string;
  taskId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  startDate: string;
  endDate: string;
  done: boolean;
  weekKey: string;
  priority: number;
  /** Sequence on the first covered day in this week (incomplete only) */
  seq?: number;
  /**
   * head = start week (full title); cont = middle weeks (thin rail);
   * end = last week (thin rail + end date)
   */
  segment: "head" | "cont" | "end";
};

/** Dashed connector joining the same multi-day task across weeks */
export type GraphBridge = {
  id: string;
  taskId: string;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  done: boolean;
};

const R = {
  year: 34,
  month: 28,
  week: 22,
  day: 18,
  task: 13,
} as const;

export const SPINE_Y = 96;
export const YEAR_X = 70;
const DAY_GAP = 52;
const TASK_GAP = 42;
const WEEK_COLLAPSED = 72;
const FRAME_H = 26;
/** 续段/结束段也保持可读高度，方便显示任务名 */
const FRAME_RAIL = 22;
const FRAME_GAP = 6;
const FRAME_TOP = 10;
const LANE_SLOT = FRAME_H + FRAME_GAP;
/** 周圆 → 长期泳道顶部 */
const FRAME_BELOW_WEEK = 14;
/** 长期泳道底 → 日圆 */
const DAY_BELOW_FRAMES = 20;
/** 无长期任务时，周圆 → 日圆的固定间距 */
const DAY_BELOW_WEEK_EMPTY = 78;

const Y = {
  week: SPINE_Y + 110,
  /** 无跨日条时的默认日圆高度（有跨日条时按泳道下推） */
  day: SPINE_Y + 210,
} as const;

/** 跨日泳道总高度（含顶距） */
function frameBandHeight(laneCount: number): number {
  if (laneCount <= 0) return 0;
  return FRAME_TOP + laneCount * LANE_SLOT;
}

/** 日圆 Y：长期条在周与日之间，当日任务只挂在日下方 */
function dayRowY(laneCount: number): number {
  const band = frameBandHeight(laneCount);
  if (band <= 0) return Y.week + R.week + DAY_BELOW_WEEK_EMPTY;
  return Y.week + R.week + FRAME_BELOW_WEEK + band + DAY_BELOW_FRAMES;
}

function isMultiDay(task: Task): boolean {
  return task.startDate !== task.endDate;
}

/**
 * Done multi-day tasks only keep a marker on startDate;
 * later days / week segments / bridges are omitted.
 */
function multiCoveredDays(task: Task, weekDays: string[]): string[] {
  const covered = weekDays.filter((d) => taskOnDay(task, d));
  if (!task.done) return covered;
  return covered.filter((d) => d === task.startDate);
}

function multiVisibleInWeek(task: Task, weekDays: string[]): boolean {
  return multiCoveredDays(task, weekDays).length > 0;
}

function uniqueColors(items: Task[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of items) {
    if (seen.has(t.color)) continue;
    seen.add(t.color);
    out.push(t.color);
  }
  return out;
}

/** Incomplete tasks on a day, ranked 1..n by priority */
export function dayTaskSeqMap(tasks: Task[], day: string): Map<string, number> {
  const list = tasksOnDay(tasks, day)
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
    );
  const map = new Map<string, number>();
  list.forEach((t, i) => map.set(t.id, i + 1));
  return map;
}

/** Interval lane packing: overlapping ranges get different lanes */
function assignLanes(
  items: { id: string; start: number; end: number }[],
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of sorted) {
    let lane = laneEnds.findIndex((end) => end < item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    lanes.set(item.id, lane);
  }
  return lanes;
}

function multiLaneCount(
  weekDays: string[],
  tasks: Task[],
): number {
  const multi = tasks.filter(
    (t) => isMultiDay(t) && multiVisibleInWeek(t, weekDays),
  );
  if (!multi.length) return 0;
  const dayIndex = new Map(weekDays.map((d, i) => [d, i]));
  const lanes = assignLanes(
    multi.map((t) => {
      const covered = multiCoveredDays(t, weekDays);
      return {
        id: t.id,
        start: dayIndex.get(covered[0]) ?? 0,
        end: dayIndex.get(covered[covered.length - 1]) ?? 0,
      };
    }),
  );
  return new Set(lanes.values()).size;
}

function collapsedMonthWidth(monthKey: string): number {
  return 78 + daysInMonth(monthKey) * 2.6;
}

function weekSlotWidth(
  week: ReturnType<typeof weeksOverlappingMonth>[number],
  expandedWeeks: Set<string>,
): number {
  if (!expandedWeeks.has(week.weekKey)) return WEEK_COLLAPSED;
  const n = Math.max(week.daysInMonth.length, 1);
  return Math.max(WEEK_COLLAPSED, (n - 1) * DAY_GAP + 56);
}

export function monthSlotWidth(
  monthKey: string,
  expandedMonths: Set<string>,
  expandedWeeks: Set<string>,
): number {
  if (!expandedMonths.has(monthKey)) return collapsedMonthWidth(monthKey);
  const weeks = weeksOverlappingMonth(monthKey);
  const inner = weeks.reduce(
    (sum, week) => sum + weekSlotWidth(week, expandedWeeks),
    0,
  );
  return Math.max(collapsedMonthWidth(monthKey), inner + 36);
}

export function buildMonthXs(
  yearKey: string,
  expandedMonths: Set<string>,
  expandedWeeks: Set<string>,
): { xs: Map<string, number>; width: number } {
  const xs = new Map<string, number>();
  let cursor = YEAR_X + 86;
  for (const monthKey of monthKeysInYear(yearKey)) {
    const w = monthSlotWidth(monthKey, expandedMonths, expandedWeeks);
    xs.set(monthKey, cursor + w / 2);
    cursor += w;
  }
  return { xs, width: cursor + 80 };
}

function branchDepth(
  monthKey: string,
  tasks: Task[],
  expandedMonths: Set<string>,
  expandedWeeks: Set<string>,
  expandedDays: Set<string>,
): number {
  if (!expandedMonths.has(monthKey)) return 0;
  const weeks = weeksOverlappingMonth(monthKey);
  let depth = Y.week - SPINE_Y + R.week + 28;
  const anyWeekOpen = weeks.some((w) => expandedWeeks.has(w.weekKey));
  if (!anyWeekOpen) return depth;

  const openWeeks = weeks.filter((w) => expandedWeeks.has(w.weekKey));
  const monthDays = [
    ...new Set(openWeeks.flatMap((w) => w.daysInMonth)),
  ].sort();
  const maxLanes =
    monthDays.length > 0 ? multiLaneCount(monthDays, tasks) : 0;
  const dayY = dayRowY(maxLanes);
  depth = dayY - SPINE_Y + R.day + 20;

  const anyDayOpen = weeks.some((w) =>
    w.daysInMonth.some((d) => expandedDays.has(d)),
  );
  if (!anyDayOpen) return depth;

  let maxSingles = 1;
  for (const w of weeks) {
    if (!expandedWeeks.has(w.weekKey)) continue;
    for (const d of w.daysInMonth) {
      if (!expandedDays.has(d)) continue;
      const singles = tasksOnDay(tasks, d).filter((t) => !isMultiDay(t)).length;
      maxSingles = Math.max(maxSingles, Math.max(singles, 1));
    }
  }
  return depth + maxSingles * TASK_GAP + 24;
}

export function buildYearGraphLayout(input: {
  yearKey: string;
  tasks: Task[];
  expandedMonths: Set<string>;
  expandedWeeks: Set<string>;
  expandedDays: Set<string>;
  todayKey: string | null;
  currentMonthKey: string | null;
}): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  frames: GraphFrame[];
  bridges: GraphBridge[];
  monthXs: Map<string, number>;
  width: number;
  height: number;
} {
  const {
    yearKey,
    tasks,
    expandedMonths,
    expandedWeeks,
    expandedDays,
    todayKey,
    currentMonthKey,
  } = input;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const frames: GraphFrame[] = [];
  const anchors: {
    taskId: string;
    color: string;
    done: boolean;
    x: number;
    y: number;
  }[] = [];
  const months = monthKeysInYear(yearKey);
  const { xs: monthXs, width } = buildMonthXs(
    yearKey,
    expandedMonths,
    expandedWeeks,
  );

  const yearTasks = tasksInRange(tasks, `${yearKey}-01-01`, `${yearKey}-12-31`);
  const yearDone = yearTasks.filter((t) => t.done).length;

  const maxBranch = Math.max(
    ...months.map((mk) =>
      branchDepth(mk, tasks, expandedMonths, expandedWeeks, expandedDays),
    ),
    40,
  );
  const height = SPINE_Y + maxBranch + 80;

  const yearId = `year:${yearKey}`;
  nodes.push({
    id: yearId,
    kind: "year",
    x: YEAR_X,
    y: SPINE_Y,
    r: R.year,
    label: yearKey,
    sublabel: `${yearDone}/${yearTasks.length}`,
    color: "#0f766e",
    expandable: false,
    expanded: true,
    taskCount: yearTasks.length,
  });

  const monthIds: string[] = [];

  months.forEach((monthKey, mi) => {
    const monthX = monthXs.get(monthKey) ?? YEAR_X;
    const monthId = `month:${monthKey}`;
    monthIds.push(monthId);
    const range = monthRangeFromKey(monthKey);
    const monthTasks = tasksInRange(tasks, range.start, range.end);
    const expanded = expandedMonths.has(monthKey);
    const isCurrent = currentMonthKey === monthKey;
    const monthMulti = monthTasks.filter(
      (t) =>
        isMultiDay(t) &&
        (!t.done ||
          (t.startDate >= range.start && t.startDate <= range.end)),
    );
    const slotW = monthSlotWidth(monthKey, expandedMonths, expandedWeeks);

    nodes.push({
      id: monthId,
      kind: "month",
      x: monthX,
      y: SPINE_Y,
      r: R.month,
      label: shortMonthLabel(monthKey),
      sublabel: `${monthTasks.filter((t) => t.done).length}/${monthTasks.length}`,
      color: expanded || isCurrent ? "#0f766e" : "#5d6b75",
      monthKey,
      expandable: true,
      expanded,
      taskCount: monthTasks.length,
      hintColors: expanded ? undefined : uniqueColors(monthMulti).slice(0, 4),
    });

    if (mi === 0) {
      edges.push({
        id: `${yearId}->${monthId}`,
        from: yearId,
        to: monthId,
        color: "#0f766e",
      });
    } else {
      edges.push({
        id: `${monthIds[mi - 1]}->${monthId}`,
        from: monthIds[mi - 1],
        to: monthId,
        color: "#c5d0d8",
      });
    }

    if (!expanded) return;

    const weeks = weeksOverlappingMonth(monthKey);
    // Month-wide lanes so the same long task stays on one row across weeks
    const monthDayKeys = [
      ...new Set(weeks.flatMap((w) => w.daysInMonth)),
    ].sort();
    const monthDayIndex = new Map(monthDayKeys.map((d, i) => [d, i]));
    const monthMultiForLanes = monthTasks
      .filter(isMultiDay)
      .filter((t) => multiVisibleInWeek(t, monthDayKeys))
      .sort(
        (a, b) =>
          a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
      );
    const monthLaneMap = assignLanes(
      monthMultiForLanes.map((t) => {
        const covered = multiCoveredDays(t, monthDayKeys);
        return {
          id: t.id,
          start: monthDayIndex.get(covered[0]) ?? 0,
          end: monthDayIndex.get(covered[covered.length - 1]) ?? 0,
        };
      }),
    );
    const monthLaneCount = monthMultiForLanes.length
      ? Math.max(0, ...monthLaneMap.values()) + 1
      : 0;
    const dayY = dayRowY(monthLaneCount);
    const frameBandTop =
      monthLaneCount > 0 ? Y.week + R.week + FRAME_BELOW_WEEK + FRAME_TOP : 0;

    // 长期任务单独编号（与当日任务分开）
    const multiSeqMap = new Map<string, number>();
    monthMultiForLanes
      .filter((t) => !t.done)
      .forEach((t, i) => multiSeqMap.set(t.id, i + 1));

    let weekCursor = monthX - slotW / 2 + 18;

    weeks.forEach((week) => {
      const slot = weekSlotWidth(week, expandedWeeks);
      const weekX = weekCursor + slot / 2;
      weekCursor += slot;

      const weekId = `week:${week.weekKey}:${monthKey}`;
      const weekExpanded = expandedWeeks.has(week.weekKey);
      const weekTasks = tasks.filter((t) =>
        week.daysInMonth.some((d) => taskOnDay(t, d)),
      );
      const weekMulti = weekTasks
        .filter(isMultiDay)
        .filter((t) => multiVisibleInWeek(t, week.daysInMonth));

      nodes.push({
        id: weekId,
        kind: "week",
        x: weekX,
        y: Y.week,
        r: R.week,
        label: week.weekKey.split("-")[1] ?? "W",
        sublabel: `${formatShortDate(week.start)}`,
        color: weekExpanded ? "#0f766e" : "#6b7c88",
        monthKey,
        weekKey: week.weekKey,
        expandable: true,
        expanded: weekExpanded,
        taskCount: weekTasks.length,
        hintColors: weekExpanded
          ? undefined
          : uniqueColors(weekMulti).slice(0, 3),
      });

      if (!weekExpanded) {
        weekMulti.forEach((task) => {
          anchors.push({
            taskId: task.id,
            color: task.color,
            done: task.done,
            x: weekX,
            y: Y.week,
          });
        });
      }
      edges.push({
        id: `${monthId}->${weekId}`,
        from: monthId,
        to: weekId,
        color: "#b7c5cf",
      });

      if (!weekExpanded) return;

      const daySpanW = (week.daysInMonth.length - 1) * DAY_GAP;
      const dayStartX = weekX - daySpanW / 2;
      const dayXMap = new Map<string, number>();

      week.daysInMonth.forEach((day, di) => {
        const dayX = dayStartX + di * DAY_GAP;
        dayXMap.set(day, dayX);
        const dayId = `day:${day}`;
        const dayExpanded = expandedDays.has(day);
        const dayTasks = tasksOnDay(tasks, day);
        const isToday = todayKey === day;
        // Done multi-day: only tint the start day; later days clear
        const covering = dayTasks.filter(
          (t) => isMultiDay(t) && (!t.done || t.startDate === day),
        );
        const coverColors = uniqueColors(covering);
        // 单任务跨日：起始日实心，其余日只描边，避免整片色块
        const tintTask = covering.length === 1 ? covering[0] : undefined;
        const tint = tintTask?.color;
        const tintIsStart = Boolean(tintTask && tintTask.startDate === day);

        nodes.push({
          id: dayId,
          kind: "day",
          x: dayX,
          y: dayY,
          r: R.day,
          label: String(Number(day.slice(8))),
          sublabel: weekdayLabel(day).replace("周", ""),
          color: isToday
            ? "#0f766e"
            : (tint ?? (dayExpanded ? "#0369a1" : "#7a8a96")),
          filled: Boolean(tint) && !isToday && tintIsStart,
          monthKey,
          weekKey: week.weekKey,
          day,
          expandable: true,
          expanded: dayExpanded,
          taskCount: dayTasks.length,
          hintColors:
            covering.length > 1 ? coverColors.slice(0, 4) : undefined,
        });
        edges.push({
          id: `${weekId}->${dayId}`,
          from: weekId,
          to: dayId,
          color: tint ?? (isToday ? "#0f766e" : "#c5d0d8"),
        });
      });

      // 长期/跨日：挂在「周圆与日圆之间」的独立泳道，与当日任务分离
      const multi = weekTasks
        .filter(isMultiDay)
        .filter((t) => multiVisibleInWeek(t, week.daysInMonth))
        .sort(
          (a, b) =>
            a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
        );

      multi.forEach((task) => {
        const covered = multiCoveredDays(task, week.daysInMonth);
        if (!covered.length) return;
        const xs = covered
          .map((d) => dayXMap.get(d))
          .filter((x): x is number => x != null);
        if (!xs.length) return;
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const lane = monthLaneMap.get(task.id) ?? 0;
        const isHead = week.daysInMonth.includes(task.startDate);
        const isEnd = week.daysInMonth.includes(task.endDate);
        const segment: GraphFrame["segment"] = isHead
          ? "head"
          : isEnd
            ? "end"
            : "cont";
        const h = segment === "head" ? FRAME_H : FRAME_RAIL;
        const laneTop = frameBandTop + lane * LANE_SLOT;
        const y = laneTop + (FRAME_H - h) / 2;
        const padX = covered.length > 1 ? DAY_GAP * 0.28 : R.day * 0.6;
        const frame: GraphFrame = {
          id: `frame:${task.id}:${week.weekKey}`,
          taskId: task.id,
          label: task.title,
          color: task.color,
          x: minX - padX,
          y,
          w: Math.max(
            maxX - minX + padX * 2,
            segment === "head" ? FRAME_H * 2.2 : FRAME_H * 1.6,
          ),
          h,
          startDate: task.startDate,
          endDate: task.endDate,
          done: task.done,
          weekKey: week.weekKey,
          priority: task.priority,
          // 各段都带序号，过几天仍能辨认是哪条长期任务
          seq: !task.done ? multiSeqMap.get(task.id) : undefined,
          segment,
        };
        frames.push(frame);
        // Done tasks: no bridge anchors (only start marker remains)
        if (!task.done) {
          const ax =
            segment === "head"
              ? frame.x + frame.w - 2
              : segment === "end"
                ? frame.x + 2
                : frame.x + frame.w / 2;
          anchors.push({
            taskId: task.id,
            color: task.color,
            done: task.done,
            x: ax,
            y: frame.y + frame.h / 2,
          });
        }
      });

      // 当日任务：只挂在日圆下方
      const taskBaseY = dayY + R.day + 16;

      week.daysInMonth.forEach((day) => {
        if (!expandedDays.has(day)) return;
        const dayX = dayXMap.get(day);
        if (dayX == null) return;
        const dayId = `day:${day}`;
        // 日下只挂「单日任务」，编号与长期分开
        const singles = tasksOnDay(tasks, day)
          .filter((t) => !isMultiDay(t))
          .sort(
            (a, b) =>
              a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
          );
        const singleSeq = new Map<string, number>();
        singles
          .filter((t) => !t.done)
          .forEach((t, i) => singleSeq.set(t.id, i + 1));
        const stack: (Task | null)[] =
          singles.length > 0 ? singles : [null];

        stack.forEach((task, ti) => {
          const taskY = taskBaseY + ti * TASK_GAP;
          if (!task) {
            const emptyId = `empty:${day}`;
            nodes.push({
              id: emptyId,
              kind: "task",
              x: dayX,
              y: taskY,
              r: R.task,
              label: "+",
              sublabel: "添加",
              color: "#b7c5cf",
              day,
              monthKey,
            });
            edges.push({
              id: `${dayId}->${emptyId}`,
              from: dayId,
              to: emptyId,
              color: "#d7e0e6",
            });
            return;
          }
          const seq = task.done ? undefined : singleSeq.get(task.id);
          nodes.push({
            id: `task:${task.id}:${day}`,
            kind: "task",
            x: dayX,
            y: taskY,
            r: R.task,
            label: task.title.slice(0, 10),
            sublabel: task.done
              ? "完成"
              : seq
                ? `${seq}. ${task.title.slice(0, 8)}`
                : task.title.slice(0, 10),
            color: task.color,
            done: task.done,
            day,
            monthKey,
            taskId: task.id,
            multiDay: false,
            priority: task.priority,
            seq,
          });
          edges.push({
            id: `${dayId}->task:${task.id}:${day}`,
            from: dayId,
            to: `task:${task.id}:${day}`,
            color: task.color,
          });
        });
      });
    });
  });

  const bridges: GraphBridge[] = [];
  const byTask = new Map<string, typeof anchors>();
  for (const a of anchors) {
    const list = byTask.get(a.taskId) ?? [];
    list.push(a);
    byTask.set(a.taskId, list);
  }
  for (const [taskId, list] of byTask) {
    const sorted = [...list].sort((a, b) => a.x - b.x || a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 24) continue;
      bridges.push({
        id: `bridge:${taskId}:${i}`,
        taskId,
        color: a.color,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        done: a.done && b.done,
      });
    }
  }

  return { nodes, edges, frames, bridges, monthXs, width, height };
}

export function bridgePath(b: GraphBridge): string {
  const mx = (b.x1 + b.x2) / 2;
  const lift = Math.min(36, Math.abs(b.x2 - b.x1) * 0.18);
  return `M ${b.x1} ${b.y1} C ${mx} ${b.y1 + lift}, ${mx} ${b.y2 + lift}, ${b.x2} ${b.y2}`;
}

export function edgePath(from: GraphNode, to: GraphNode): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const x1 = from.x + (dx / len) * from.r;
  const y1 = from.y + (dy / len) * from.r;
  const x2 = to.x - (dx / len) * to.r;
  const y2 = to.y - (dy / len) * to.r;

  if (Math.abs(dy) < 8) {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  }
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
}
