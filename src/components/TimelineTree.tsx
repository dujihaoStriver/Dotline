"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { nextTaskColor } from "@/lib/colors";
import {
  formatDateRange,
  formatShortDate,
  getMonthKey,
  getWeekKey,
  getYearKey,
  monthLabel,
  monthRangeFromKey,
  parseDateKey,
  toDateKey,
  weekRangeFromKey,
  yearRangeFromKey,
} from "@/lib/dates";
import {
  bridgePath,
  buildMonthXs,
  buildYearGraphLayout,
  carriedDisplayColor,
  dayTaskSeqMap,
  edgePath,
  type GraphFrame,
  type GraphNode,
} from "@/lib/graph-layout";
import { isMultiDayTask, splitDayTasks, tasksInRange } from "@/lib/review-draft";
import type { Task } from "@/lib/types";
import { useClientNow } from "@/lib/use-client-now";
import { useStore } from "@/lib/use-store";
import { BackupPanel } from "./BackupPanel";
import { QuickAddBar } from "./QuickAddBar";
import { ReviewPanel } from "./ReviewPanel";
import { TaskForm, type TaskFormValue } from "./TaskForm";
import { Toast } from "./Toast";

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.4;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

type Selection =
  | { type: "year" }
  | { type: "month"; monthKey: string }
  | { type: "week"; weekKey: string; monthKey?: string }
  | { type: "day"; day: string }
  | { type: "task"; taskId: string; day: string }
  | { type: "add"; day: string }
  | null;

function DayAside({
  day,
  tasks,
  onPickTask,
  onAdd,
}: {
  day: string;
  tasks: Task[];
  onPickTask: (taskId: string, day: string) => void;
  onAdd: () => void;
}) {
  const { dayTasks, longTasks } = splitDayTasks(tasks, day);

  function Row({ task }: { task: Task }) {
    return (
      <button
        type="button"
        onClick={() => onPickTask(task.id, day)}
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-[var(--chip)]"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: carriedDisplayColor(task) }}
        />
        <span
          className={`min-w-0 flex-1 truncate text-xs ${
            task.done || task.carriedTo
              ? "text-[var(--muted)] line-through"
              : "text-[var(--ink)]"
          }`}
        >
          {task.title}
        </span>
        {isMultiDayTask(task) ? (
          <span className="shrink-0 text-[10px] text-[var(--muted)]">跨日</span>
        ) : null}
        {task.carriedTo ? (
          <span className="shrink-0 rounded-md bg-[var(--chip)] px-1 py-0.5 text-[10px] font-medium text-[var(--muted)]">
            已结转
          </span>
        ) : task.carriedFrom && !task.done ? (
          <span className="shrink-0 rounded-md bg-[#b45309]/12 px-1 py-0.5 text-[10px] font-medium text-[#b45309]">
            遗留
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display font-semibold text-[var(--ink)]">{day}</p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-soft)]"
        >
          + 添加
        </button>
      </div>

      <div className="space-y-1.5">
        <p className="px-0.5 text-[11px] font-medium text-[var(--muted)]">
          当日 · {dayTasks.length}
        </p>
        {dayTasks.length ? (
          dayTasks.map((t) => <Row key={t.id} task={t} />)
        ) : (
          <p className="px-2 py-2 text-[11px] text-[var(--muted)]">暂无单日任务</p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="px-0.5 text-[11px] font-medium text-[var(--muted)]">
          长期 · {longTasks.length}
        </p>
        {longTasks.length ? (
          longTasks.map((t) => <Row key={t.id} task={t} />)
        ) : (
          <p className="px-2 py-2 text-[11px] text-[var(--muted)]">
            暂无跨日任务
          </p>
        )}
      </div>
    </div>
  );
}

export function TimelineTree({ initialYearKey }: { initialYearKey: string }) {
  const {
    tasks,
    reviews,
    saveTask,
    removeTask,
    toggleDone,
    reorderTask,
    saveReview,
    findReview,
  } = useStore();
  const now = useClientNow();
  const [yearKey, setYearKey] = useState(initialYearKey);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);
  const [hoverFrameId, setHoverFrameId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dragOverBeforeId, setDragOverBeforeId] = useState<string | null | undefined>(
    undefined,
  );
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  /** Brief checkmark burst after completing a task */
  const [doneFlashId, setDoneFlashId] = useState<string | null>(null);
  const doneFlashTimer = useRef<number | null>(null);

  const [scale, setScale] = useState(0.72);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  /** Latest pan/scale for wheel zoom (avoids stale state / nested setState). */
  const viewRef = useRef({ pan: { x: 20, y: 20 }, scale: 0.72 });
  /** Skip React re-render while dragging the canvas; write transform to DOM. */
  const panRaf = useRef<number | null>(null);
  const scaleUiRaf = useRef<number | null>(null);
  const panning = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const taskDrag = useRef<{
    id: string;
    peerIds: string[];
    startY: number;
    moved: boolean;
    overBeforeId: string | null;
    onTap: () => void;
  } | null>(null);
  const lastTaskTap = useRef<{ id: string; t: number } | null>(null);
  const didInitYear = useRef<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function applyWorldTransform(
    nextPan: { x: number; y: number },
    nextScale: number,
  ) {
    viewRef.current = { pan: nextPan, scale: nextScale };
    const g = worldRef.current;
    if (g) {
      g.setAttribute(
        "transform",
        `translate(${nextPan.x} ${nextPan.y}) scale(${nextScale})`,
      );
    }
  }

  function commitView(nextPan: { x: number; y: number }, nextScale: number) {
    applyWorldTransform(nextPan, nextScale);
    setPan(nextPan);
    setScale(nextScale);
  }

  /** Live pan during drag — DOM only, no React re-render of the SVG tree. */
  function livePan(nextPan: { x: number; y: number }) {
    applyWorldTransform(nextPan, viewRef.current.scale);
    if (panRaf.current != null) return;
    panRaf.current = window.requestAnimationFrame(() => {
      panRaf.current = null;
    });
  }

  function flushPanToReact() {
    const { pan: p, scale: s } = viewRef.current;
    setPan(p);
    setScale(s);
  }

  function scheduleScaleUi(nextScale: number) {
    if (scaleUiRaf.current != null) {
      window.cancelAnimationFrame(scaleUiRaf.current);
    }
    scaleUiRaf.current = window.requestAnimationFrame(() => {
      scaleUiRaf.current = null;
      setScale(nextScale);
      setPan(viewRef.current.pan);
    });
  }

  function clientToViewport(el: HTMLElement, clientX: number, clientY: number) {
    const rect = el.getBoundingClientRect();
    return {
      x: clientX - rect.left - el.clientLeft,
      y: clientY - rect.top - el.clientTop,
    };
  }

  function zoomToClient(clientX: number, clientY: number, nextScale: number) {
    const el = viewportRef.current;
    const { pan: curPan, scale: curScale } = viewRef.current;
    const clamped = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (clamped === curScale) return;
    if (!el) {
      commitView(curPan, clamped);
      return;
    }
    const { x: mx, y: my } = clientToViewport(el, clientX, clientY);
    const wx = (mx - curPan.x) / curScale;
    const wy = (my - curPan.y) / curScale;
    commitView({ x: mx - wx * clamped, y: my - wy * clamped }, clamped);
  }

  useEffect(() => {
    setYearKey(initialYearKey);
  }, [initialYearKey]);

  const todayKey = now ? toDateKey(now) : null;
  const currentMonthKey = now ? getMonthKey(now) : null;
  const currentWeekKey = now ? getWeekKey(now) : null;

  function flash(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2000);
  }

  function cameraToMonth(
    yKey: string,
    months: Set<string>,
    weeks: Set<string>,
    monthKey: string,
    s = 0.72,
    days: Set<string> = new Set(),
  ) {
    const monthX =
      buildMonthXs(yKey, months, weeks, days, tasks).xs.get(monthKey) ?? 200;
    const viewW = viewportRef.current?.clientWidth ?? 900;
    commitView({ x: viewW / 2 - monthX * s, y: 24 }, s);
  }

  function focusNow() {
    if (!now) return;
    const y = getYearKey(now);
    const months = new Set([getMonthKey(now)]);
    const weeks = new Set([getWeekKey(now)]);
    const days = new Set([toDateKey(now)]);
    if (yearKey !== y) {
      didInitYear.current = null;
      setYearKey(y);
      return;
    }
    setExpandedMonths(months);
    setExpandedWeeks(weeks);
    setExpandedDays(days);
    cameraToMonth(y, months, weeks, getMonthKey(now), 0.72, days);
  }

  useEffect(() => {
    if (!now) return;
    if (didInitYear.current === yearKey) return;
    didInitYear.current = yearKey;
    setSelection(null);

    if (getYearKey(now) === yearKey) {
      const months = new Set([getMonthKey(now)]);
      const weeks = new Set([getWeekKey(now)]);
      const days = new Set([toDateKey(now)]);
      setExpandedMonths(months);
      setExpandedWeeks(weeks);
      setExpandedDays(days);
      cameraToMonth(yearKey, months, weeks, getMonthKey(now), 0.72, days);
    } else {
      const months = new Set([`${yearKey}-01`]);
      setExpandedMonths(months);
      setExpandedWeeks(new Set());
      setExpandedDays(new Set());
      cameraToMonth(yearKey, months, new Set(), `${yearKey}-01`);
    }
  }, [yearKey, now]);

  const range = yearRangeFromKey(yearKey);
  const yearTasks = useMemo(
    () => tasksInRange(tasks, range.start, range.end),
    [tasks, range.start, range.end],
  );
  const done = yearTasks.filter((t) => t.done).length;
  const multiDayCount = yearTasks.filter(
    (t) => t.startDate !== t.endDate,
  ).length;

  const layout = useMemo(
    () =>
      buildYearGraphLayout({
        yearKey,
        tasks,
        expandedMonths,
        expandedWeeks,
        expandedDays,
        todayKey,
        currentMonthKey,
      }),
    [
      yearKey,
      tasks,
      expandedMonths,
      expandedWeeks,
      expandedDays,
      todayKey,
      currentMonthKey,
    ],
  );

  const nodeMap = useMemo(() => {
    const m = new Map<string, GraphNode>();
    layout.nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [layout.nodes]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const { pan: curPan, scale: curScale } = viewRef.current;
      const next = clamp(
        curScale * (e.deltaY > 0 ? 0.9 : 1.1),
        MIN_SCALE,
        MAX_SCALE,
      );
      if (next === curScale) return;
      const { x: mx, y: my } = clientToViewport(el, e.clientX, e.clientY);
      const wx = (mx - curPan.x) / curScale;
      const wy = (my - curPan.y) / curScale;
      const nextPan = { x: mx - wx * next, y: my - wy * next };
      applyWorldTransform(nextPan, next);
      scheduleScaleUi(next);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
      if (panRaf.current != null) window.cancelAnimationFrame(panRaf.current);
      if (scaleUiRaf.current != null)
        window.cancelAnimationFrame(scaleUiRaf.current);
    };
  }, []);

  function resolveDropBeforeWorld(
    peerIds: string[],
    worldY: number,
  ): string | null {
    type Peer = { id: string; y: number; h: number };
    const peers: Peer[] = [];
    for (const id of peerIds) {
      const frame = layout.frames.find((f) => f.taskId === id);
      if (frame) {
        peers.push({ id, y: frame.y, h: frame.h });
        continue;
      }
      const node = layout.nodes.find(
        (n) => n.kind === "task" && n.taskId === id,
      );
      if (node) peers.push({ id, y: node.y - node.r, h: node.r * 2 });
    }
    peers.sort((a, b) => a.y - b.y);
    for (const p of peers) {
      if (worldY < p.y + p.h / 2) return p.id;
    }
    return null;
  }

  function beginTaskDrag(
    e: ReactPointerEvent,
    taskId: string,
    peerIds: string[],
    onTap: () => void,
  ) {
    e.stopPropagation();
    taskDrag.current = {
      id: taskId,
      peerIds: peerIds.filter((id) => id !== taskId),
      startY: e.clientY,
      moved: false,
      overBeforeId: taskId,
      onTap,
    };
    // Capture on viewport so move/up still arrive; tap is handled in onPointerUp
    // because capture suppresses click/dblclick on the SVG node.
    viewportRef.current?.setPointerCapture(e.pointerId);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-node],[data-frame]")) return;
    const { pan: curPan } = viewRef.current;
    panning.current = {
      x: e.clientX,
      y: e.clientY,
      panX: curPan.x,
      panY: curPan.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  // Keep SVG world transform in sync with viewRef even when unrelated state re-renders.
  useLayoutEffect(() => {
    applyWorldTransform(viewRef.current.pan, viewRef.current.scale);
  });

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (taskDrag.current) {
      const d = taskDrag.current;
      if (!d.moved && Math.abs(e.clientY - d.startY) > 6) {
        d.moved = true;
        setDraggingTaskId(d.id);
      }
      if (d.moved) {
        const { pan: curPan, scale: curScale } = viewRef.current;
        const el = viewportRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const worldY = (e.clientY - rect.top - curPan.y) / curScale;
        const before = resolveDropBeforeWorld(
          [d.id, ...d.peerIds],
          worldY,
        );
        const nextBefore = before === d.id ? d.overBeforeId : before;
        if (nextBefore !== d.overBeforeId) {
          d.overBeforeId = nextBefore;
          setDragOverBeforeId(nextBefore);
        }
      }
      return;
    }
    if (!panning.current) return;
    livePan({
      x: panning.current.panX + (e.clientX - panning.current.x),
      y: panning.current.panY + (e.clientY - panning.current.y),
    });
  }

  function endInteraction(el: HTMLElement, pointerId: number) {
    if (taskDrag.current) {
      const d = taskDrag.current;
      if (d.moved) {
        reorderTask(d.id, d.overBeforeId);
        flash("已调整优先级");
        lastTaskTap.current = null;
      } else {
        const nowMs = Date.now();
        const prev = lastTaskTap.current;
        if (prev && prev.id === d.id && nowMs - prev.t < 520) {
          markDone(d.id);
          lastTaskTap.current = null;
        } else {
          d.onTap();
          lastTaskTap.current = { id: d.id, t: nowMs };
        }
      }
      taskDrag.current = null;
      setDraggingTaskId(null);
      setDragOverBeforeId(undefined);
    }
    if (panning.current) {
      panning.current = null;
      flushPanToReact();
    }
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    endInteraction(e.currentTarget, e.pointerId);
  }

  function toggleMonth(monthKey: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) next.delete(monthKey);
      else {
        next.clear();
        next.add(monthKey);
      }
      return next;
    });
    setSelection({ type: "month", monthKey });
  }

  function toggleWeek(weekKey: string, monthKey?: string) {
    if (monthKey) setExpandedMonths(new Set([monthKey]));
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
    setSelection({ type: "week", weekKey, monthKey });
  }

  function toggleDay(day: string, weekKey?: string, monthKey?: string) {
    if (monthKey) setExpandedMonths(new Set([monthKey]));
    if (weekKey) setExpandedWeeks((prev) => new Set(prev).add(weekKey));
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
    setSelection({ type: "day", day });
  }

  function handleNodeClick(node: GraphNode) {
    if (node.kind === "year") {
      setSelection({ type: "year" });
      return;
    }
    if (node.kind === "month" && node.monthKey) {
      toggleMonth(node.monthKey);
      return;
    }
    if (node.kind === "week" && node.weekKey) {
      toggleWeek(node.weekKey, node.monthKey);
      return;
    }
    if (node.kind === "day" && node.day) {
      toggleDay(node.day, node.weekKey, node.monthKey);
      return;
    }
    if (node.kind === "task") {
      if (node.taskId && node.day) {
        setSelection({ type: "task", taskId: node.taskId, day: node.day });
      } else if (node.day) {
        setSelection({ type: "add", day: node.day });
      }
    }
  }

  function handleFrameClick(frame: GraphFrame) {
    setSelection({
      type: "task",
      taskId: frame.taskId,
      day: frame.startDate,
    });
  }

  function markDone(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (task?.carriedTo) {
      flash("已结转 · 原日留底");
      return;
    }
    const willComplete = !task?.done;
    toggleDone(id);
    flash(willComplete ? "已完成" : "已撤销完成");
    if (willComplete) {
      if (doneFlashTimer.current) window.clearTimeout(doneFlashTimer.current);
      setDoneFlashId(id);
      doneFlashTimer.current = window.setTimeout(() => {
        setDoneFlashId(null);
        doneFlashTimer.current = null;
      }, 700);
    } else {
      setDoneFlashId(null);
    }
  }

  const selectedTask =
    selection?.type === "task"
      ? tasks.find((t) => t.id === selection.taskId)
      : undefined;

  const weekSel =
    selection?.type === "week" ? weekRangeFromKey(selection.weekKey) : null;
  const monthSel =
    selection?.type === "month" ? monthRangeFromKey(selection.monthKey) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="dx-panel flex items-center gap-0.5 rounded-xl p-0.5">
          <button
            type="button"
            className="dx-btn rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-sm"
            onClick={() => {
              didInitYear.current = null;
              setYearKey((y) => String(Number(y) - 1));
            }}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--chip)]"
            onClick={focusNow}
          >
            今年
          </button>
          <button
            type="button"
            className="dx-btn rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-sm"
            onClick={() => {
              didInitYear.current = null;
              setYearKey((y) => String(Number(y) + 1));
            }}
          >
            →
          </button>
          <span className="mx-1.5 hidden h-4 w-px bg-[var(--line)] sm:block" />
          <span className="hidden pr-2 font-display text-sm font-semibold tracking-tight text-[var(--ink)] sm:inline">
            {yearKey}
            <span className="ml-0.5 text-xs font-normal text-[var(--muted)]">
              年
            </span>
          </span>
          {multiDayCount > 0 ? (
            <span className="mr-1 rounded-lg bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-ink)]">
              {multiDayCount} 跨日
            </span>
          ) : null}
        </div>

        <div className="dx-panel flex items-center gap-0.5 rounded-xl p-0.5">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs text-[var(--ink-soft)] transition-colors hover:bg-[var(--chip)]"
            onClick={() => {
              const el = viewportRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              zoomToClient(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
                viewRef.current.scale / 1.15,
              );
            }}
          >
            −
          </button>
          <span className="min-w-11 text-center font-mono text-[11px] tabular-nums text-[var(--muted)]">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs text-[var(--ink-soft)] transition-colors hover:bg-[var(--chip)]"
            onClick={() => {
              const el = viewportRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              zoomToClient(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
                viewRef.current.scale * 1.15,
              );
            }}
          >
            +
          </button>
          <span className="mx-0.5 h-4 w-px bg-[var(--line)]" />
          <button
            type="button"
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-soft)]"
            onClick={focusNow}
          >
            复位
          </button>
        </div>
      </div>

      {todayKey ? (
        <QuickAddBar
          key={todayKey}
          defaultStart={todayKey}
          defaultColor={nextTaskColor(tasks.map((t) => t.color))}
          usedColors={tasks.map((t) => t.color)}
          emptyHint={yearTasks.length === 0}
          onAdd={({ title, startDate, endDate, color }) => {
            saveTask({
              title,
              note: "",
              kind: "all_day",
              startDate,
              endDate,
              color,
              startAt: null,
              endAt: null,
              done: false,
              doneAt: null,
              carriedFrom: null,
              carriedTo: null,
            });
            const mk = startDate.slice(0, 7);
            const wk = getWeekKey(parseDateKey(startDate));
            setExpandedMonths(new Set([mk]));
            setExpandedWeeks((prev) => new Set(prev).add(wk));
            setExpandedDays((prev) => new Set(prev).add(startDate));
            flash("已添加");
          }}
        />
      ) : null}

      <p className="shrink-0 text-[11px] tracking-wide text-[var(--muted)] sm:text-xs">
        拖动排序 · 双击完成 · 未完成单日自动结转 · 滚轮缩放
        {currentWeekKey ? ` · 本周 ${currentWeekKey}` : ""}
      </p>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_328px]">
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="dx-panel relative min-h-[280px] flex-1 cursor-grab overflow-hidden rounded-[var(--radius-panel)] active:cursor-grabbing lg:min-h-0"
          style={{
            backgroundColor: "color-mix(in oklab, var(--surface-solid) 90%, transparent)",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, #121a21 9%, transparent) 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
        >
          <Toast message={toast} />
          <svg
            width="100%"
            height="100%"
            className="absolute inset-0 block h-full w-full select-none"
            style={{ shapeRendering: "geometricPrecision" }}
          >
            <defs>
              <filter
                id="node-shadow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feDropShadow
                  dx="0"
                  dy="1"
                  stdDeviation="1.2"
                  floodColor="#152028"
                  floodOpacity="0.12"
                />
              </filter>
              <filter
                id="frame-glow"
                x="-20%"
                y="-30%"
                width="140%"
                height="160%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="2.2"
                  floodColor="#0f766e"
                  floodOpacity="0.28"
                />
              </filter>
            </defs>

            <g
              ref={worldRef}
              transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}
            >
              <line
                className="dx-spine"
                pathLength={1}
                x1={70}
                y1={96}
                x2={layout.width - 40}
                y2={96}
                stroke="#e2e8ed"
                strokeWidth={6}
                strokeLinecap="round"
              />

              {layout.edges.map((edge, ei) => {
                const from = nodeMap.get(edge.from);
                const to = nodeMap.get(edge.to);
                if (!from || !to) return null;
                return (
                  <path
                    key={edge.id}
                    className="dx-edge-draw"
                    pathLength={1}
                    d={edgePath(from, to)}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.9}
                    style={
                      {
                        ["--dx-delay"]: `${Math.min(ei, 24) * 18}ms`,
                      } as CSSProperties
                    }
                  />
                );
              })}

              {layout.bridges.map((b) => (
                <path
                  key={b.id}
                  className={b.done ? undefined : "dx-bridge-flow"}
                  d={bridgePath(b)}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={1.15}
                  strokeDasharray="3 5"
                  strokeLinecap="round"
                  opacity={b.done ? 0.25 : 0.4}
                />
              ))}

              {layout.frames.map((frame, fi) => {
                const active =
                  hoverFrameId === frame.id ||
                  (selection?.type === "task" &&
                    selection.taskId === frame.taskId);
                const isDragging = draggingTaskId === frame.taskId;
                const dropHere =
                  dragOverBeforeId === frame.taskId &&
                  draggingTaskId &&
                  draggingTaskId !== frame.taskId;
                const justDone = doneFlashId === frame.taskId;
                const isHead = frame.segment === "head";
                const isRail = !isHead;
                const seqPrefix =
                  !frame.done && frame.seq != null ? `${frame.seq}. ` : "";
                // 续段加「…」前缀，表示这是跨日任务的后续几天
                const contPrefix = isRail && !frame.done ? "…" : "";
                const rawLabel = frame.done
                  ? `✓ ${frame.label}`
                  : `${contPrefix}${seqPrefix}${frame.label}`;
                const maxChars = frame.w > 120 ? 16 : frame.w > 80 ? 12 : 8;
                const label =
                  rawLabel.length > maxChars
                    ? `${rawLabel.slice(0, maxChars)}…`
                    : rawLabel;
                const endMark = formatShortDate(frame.endDate);
                const weekPeers = layout.frames
                  .filter((f) => f.weekKey === frame.weekKey)
                  .sort((a, b) => a.priority - b.priority)
                  .map((f) => f.taskId);
                return (
                  <g
                    key={frame.id}
                    data-frame
                    className="dx-frame-enter cursor-grab active:cursor-grabbing"
                    opacity={
                      isDragging ? 0.45 : frame.done ? 0.5 : isRail ? 0.85 : 1
                    }
                    filter={active && isHead ? "url(#frame-glow)" : undefined}
                    style={
                      {
                        ["--dx-delay"]: `${80 + Math.min(fi, 12) * 40}ms`,
                      } as CSSProperties
                    }
                    onMouseEnter={() => setHoverFrameId(frame.id)}
                    onMouseLeave={() => setHoverFrameId(null)}
                    onPointerDown={(e) =>
                      beginTaskDrag(e, frame.taskId, weekPeers, () =>
                        handleFrameClick(frame),
                      )
                    }
                  >
                    <title>
                      {frame.label}
                      {` · ${formatDateRange(frame.startDate, frame.endDate)}`}
                    </title>
                    {dropHere ? (
                      <line
                        x1={frame.x}
                        x2={frame.x + frame.w}
                        y1={frame.y - 3}
                        y2={frame.y - 3}
                        stroke={frame.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    ) : null}
                    <rect
                      x={frame.x}
                      y={frame.y}
                      width={frame.w}
                      height={frame.h}
                      rx={frame.h / 2}
                      ry={frame.h / 2}
                      fill={frame.color}
                      fillOpacity={
                        frame.done
                          ? 0.42
                          : isRail
                            ? active
                              ? 0.7
                              : 0.48
                            : active
                              ? 0.9
                              : 0.78
                      }
                      stroke={frame.color}
                      strokeWidth={
                        active || isDragging ? (isRail ? 1.6 : 2.4) : isRail ? 0.8 : 1
                      }
                      strokeDasharray={frame.done ? "4 3" : undefined}
                    />
                    {isHead && frame.done ? (
                      <g
                        className={justDone ? "dx-check-pop" : undefined}
                        transform={`translate(${frame.x + 12}, ${frame.y + frame.h / 2})`}
                      >
                        {justDone ? (
                          <circle
                            className="dx-check-burst"
                            r={10}
                            fill="#ffffff"
                            opacity={0.35}
                          />
                        ) : null}
                        <circle r={7} fill="#ffffff" />
                        <path
                          d="M-3 0.2 L-1 2.4 L3.2 -2.2"
                          fill="none"
                          stroke={frame.color}
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    ) : null}
                    {/* 起始 / 续段 / 结束 都显示任务名，避免过几天只剩色条认不出 */}
                    {frame.w > 36 ? (
                      <text
                        x={
                          isHead && frame.done
                            ? frame.x + frame.w / 2 + 6
                            : frame.x + frame.w / 2
                        }
                        y={frame.y + frame.h / 2 + 0.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={isRail ? 9 : 10}
                        fontWeight={700}
                        opacity={frame.done ? 0.92 : isRail ? 0.95 : 1}
                      >
                        {frame.w > 56
                          ? label
                          : frame.done
                            ? "✓"
                            : frame.seq != null
                              ? String(frame.seq)
                              : "···"}
                      </text>
                    ) : null}
                    {frame.segment === "end" && frame.w > 100 ? (
                      <text
                        x={frame.x + frame.w - 8}
                        y={frame.y + frame.h / 2 + 0.5}
                        textAnchor="end"
                        dominantBaseline="central"
                        fill="#ffffff"
                        fontSize={7}
                        fontWeight={600}
                        opacity={0.75}
                      >
                        {endMark}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {layout.nodes.map((node, ni) => {
                const isTask = node.kind === "task";
                const isTodayDay =
                  node.kind === "day" && todayKey != null && node.day === todayKey;
                const fill =
                  (isTask && node.taskId) || node.filled
                    ? node.color
                    : "#ffffff";
                const selected =
                  selection?.type === "task" &&
                  node.taskId &&
                  selection.taskId === node.taskId;
                const justDone =
                  Boolean(node.taskId) && doneFlashId === node.taskId;
                const carriedAway = Boolean(node.carriedTo);
                const carriedIn = Boolean(
                  node.carriedFrom && !node.carriedTo && !node.done,
                );
                const isDragging =
                  Boolean(node.taskId) && draggingTaskId === node.taskId;
                const dropHere =
                  Boolean(node.taskId) &&
                  dragOverBeforeId === node.taskId &&
                  draggingTaskId &&
                  draggingTaskId !== node.taskId;
                const dayPeers =
                  node.kind === "task" && node.day
                    ? layout.nodes
                        .filter(
                          (n) =>
                            n.kind === "task" &&
                            n.day === node.day &&
                            n.taskId,
                        )
                        .sort(
                          (a, b) =>
                            (a.priority ?? 0) - (b.priority ?? 0) ||
                            a.y - b.y,
                        )
                        .map((n) => n.taskId!)
                    : [];
                const kindDelay =
                  node.kind === "year"
                    ? 0
                    : node.kind === "month"
                      ? 40
                      : node.kind === "week"
                        ? 80
                        : node.kind === "day"
                          ? 120
                          : 160;
                return (
                  <g
                    key={node.id}
                    data-node
                    transform={`translate(${node.x}, ${node.y})`}
                    className={
                      node.taskId
                        ? "cursor-grab active:cursor-grabbing"
                        : "cursor-pointer"
                    }
                    opacity={isDragging ? 0.45 : 1}
                    onPointerDown={(e) => {
                      if (node.taskId) {
                        beginTaskDrag(e, node.taskId, dayPeers, () =>
                          handleNodeClick(node),
                        );
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Tasks use pointer-up tap (capture steals click); others keep click.
                      if (!node.taskId) handleNodeClick(node);
                    }}
                  >
                    <g
                      className="dx-node-enter"
                      style={
                        {
                          ["--dx-delay"]: `${kindDelay + Math.min(ni, 20) * 16}ms`,
                        } as CSSProperties
                      }
                    >
                    {dropHere ? (
                      <line
                        x1={-22}
                        x2={22}
                        y1={-node.r - 6}
                        y2={-node.r - 6}
                        stroke={node.color}
                        strokeWidth={3}
                        strokeLinecap="round"
                      />
                    ) : null}
                    {isTodayDay ? (
                      <>
                        <circle
                          className="dx-today-ring"
                          r={node.r + 10}
                          fill="none"
                          stroke="#0d6b63"
                          strokeWidth={1.6}
                        />
                        <circle
                          className="dx-today-glow"
                          r={node.r + 8}
                          fill="#0d6b63"
                        />
                      </>
                    ) : null}
                    {node.multiDay ? (
                      <circle
                        r={node.r + 7}
                        fill="none"
                        stroke={node.color}
                        strokeWidth={1.5}
                        strokeDasharray="3 2"
                        opacity={0.7}
                      />
                    ) : null}
                    <circle r={node.r + 5} fill={node.color} opacity={0.12} />
                    {justDone ? (
                      <circle
                        className="dx-check-burst"
                        r={node.r + 6}
                        fill={node.color}
                        opacity={0.35}
                      />
                    ) : null}
                    <circle
                      r={node.r}
                      fill={
                        isTask && node.taskId && node.done
                          ? node.color
                          : fill
                      }
                      stroke={node.color}
                      strokeWidth={
                        selected || node.multiDay || node.done
                          ? 3
                          : node.kind === "year"
                            ? 3
                            : 2.2
                      }
                      strokeDasharray={
                        isTask && node.taskId && node.done ? "3 2" : undefined
                      }
                      filter="url(#node-shadow)"
                      opacity={node.done ? 0.78 : carriedAway ? 0.45 : 1}
                    />
                    {isTask && node.taskId && node.done ? (
                      <g className={justDone ? "dx-check-pop" : undefined}>
                        <circle r={node.r * 0.72} fill="#ffffff" />
                        <path
                          d={`M${-node.r * 0.28} 0 L${-node.r * 0.08} ${node.r * 0.22} L${node.r * 0.32} ${-node.r * 0.24}`}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    ) : (
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={
                          (isTask && node.taskId) || node.filled
                            ? "#ffffff"
                            : node.kind === "year"
                              ? node.color
                              : "#152028"
                        }
                        fontSize={
                          node.kind === "year"
                            ? 12
                            : node.kind === "month"
                              ? 11
                              : node.kind === "task"
                                ? node.taskId
                                  ? carriedIn
                                    ? 8
                                    : 9
                                  : 13
                                : 10
                        }
                        fontWeight={600}
                      >
                        {isTask
                          ? node.taskId
                            ? carriedAway
                              ? "→"
                              : carriedIn
                                ? "遗留"
                                : node.seq != null
                                  ? String(node.seq)
                                  : node.label.slice(0, 2)
                            : "+"
                          : node.label}
                      </text>
                    )}
                    {node.kind === "task" && node.taskId && carriedAway ? (
                      <text
                        y={node.r + 11}
                        textAnchor="middle"
                        fill="#8a969f"
                        fontSize={8}
                        fontWeight={600}
                      >
                        已结转
                      </text>
                    ) : null}
                    <text
                      y={
                        node.kind === "task" && node.taskId && carriedAway
                          ? node.r + 22
                          : node.r + 13
                      }
                      textAnchor="middle"
                      fill={
                        node.done || carriedAway
                          ? "#8a969f"
                          : node.multiDay
                            ? node.color
                            : "#5d6b75"
                      }
                      fontSize={9}
                      fontWeight={node.multiDay ? 600 : 400}
                      textDecoration={
                        node.done || carriedAway ? "line-through" : undefined
                      }
                    >
                      {node.kind === "task" && node.taskId
                        ? node.done
                          ? `✓ ${node.label}`
                          : carriedAway
                            ? `→ ${node.label}`
                            : node.seq != null
                              ? `${node.seq}. ${node.label}`
                              : node.label
                        : node.sublabel}
                    </text>
                    {node.hintColors?.map((c, i) => {
                      const n = node.hintColors!.length;
                      const spread = (n - 1) * 7;
                      return (
                        <circle
                          key={`${c}-${i}`}
                          className="dx-hint-dot"
                          cx={-spread / 2 + i * 7}
                          cy={node.r + 9}
                          r={3.2}
                          fill={c}
                          stroke="#fff"
                          strokeWidth={0.8}
                          style={
                            {
                              ["--dx-delay"]: `${i * 180}ms`,
                            } as CSSProperties
                          }
                        />
                      );
                    })}
                    {typeof node.taskCount === "number" &&
                    (node.kind === "month" ||
                      node.kind === "week" ||
                      node.kind === "day") &&
                    !node.expanded &&
                    (node.kind === "day"
                      ? node.taskCount > 0
                      : !node.hintColors?.length) ? (
                      <g
                        transform={`translate(${node.r * 0.72}, ${-node.r * 0.72})`}
                      >
                        <circle
                          r={node.taskCount > 9 ? 8.5 : 7.5}
                          fill={node.color}
                          stroke="#fff"
                          strokeWidth={1.2}
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#fff"
                          fontSize={node.taskCount > 9 ? 7 : 8}
                          fontWeight={700}
                        >
                          {node.taskCount > 99 ? "99+" : node.taskCount}
                        </text>
                      </g>
                    ) : null}
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="dx-panel flex max-h-[42vh] flex-col gap-3 overflow-y-auto rounded-[var(--radius-panel)] p-3.5 lg:max-h-none">
          <div
            key={
              selection
                ? `${selection.type}:${
                    selection.type === "task"
                      ? selection.taskId
                      : selection.type === "month"
                        ? selection.monthKey
                        : selection.type === "week"
                          ? selection.weekKey
                          : selection.type === "day" || selection.type === "add"
                            ? selection.day
                            : "year"
                  }`
                : `home:${yearKey}`
            }
            className="dx-aside-swap flex flex-col gap-3"
          >
          {!selection ? (
            <div className="space-y-3 text-sm text-[var(--muted)]">
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-[var(--ink)]">
                  {yearKey}
                  <span className="ml-1 text-sm font-normal text-[var(--muted)]">
                    年览
                  </span>
                </p>
                <p className="mt-1 font-mono text-[11px] tracking-wide">
                  {range.start} → {range.end}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-[var(--chip)] px-2.5 py-1 text-xs text-[var(--ink-soft)]">
                  完成 {done}/{yearTasks.length}
                </span>
                {multiDayCount > 0 ? (
                  <span className="rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent-ink)]">
                    跨日 {multiDayCount}
                  </span>
                ) : null}
              </div>
              {yearTasks.length === 0 ? (
                <p className="rounded-xl bg-[var(--accent-soft)]/80 px-3 py-2.5 text-xs leading-relaxed text-[var(--accent-ink)]">
                  还没有任务。在上方写第一件事，回车即可落在时间线上。
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-[var(--muted)]">
                  长期任务在日期圆上方横条；当日任务挂在日期圆下方。
                </p>
              )}
            </div>
          ) : null}

          {selection?.type === "year" ? (
            <div className="space-y-2">
              <p className="font-display font-semibold text-[var(--ink)]">
                {yearKey} 年复盘
              </p>
              <ReviewPanel
                compact
                period="year"
                periodKey={yearKey}
                periodStart={range.start}
                periodEnd={range.end}
                tasks={tasks}
                reviews={reviews}
                existing={findReview("year", yearKey)}
                onSave={({ content, insights, carryovers }) => {
                  saveReview({
                    period: "year",
                    periodKey: yearKey,
                    periodStart: range.start,
                    periodEnd: range.end,
                    content,
                    insights,
                    carryovers,
                  });
                  flash("年总结已保存");
                }}
              />
            </div>
          ) : null}

          {selection?.type === "month" && monthSel ? (
            <div className="space-y-2">
              <p className="font-display font-semibold text-[var(--ink)]">
                {monthLabel(selection.monthKey)}复盘
              </p>
              <ReviewPanel
                compact
                period="month"
                periodKey={selection.monthKey}
                periodStart={monthSel.start}
                periodEnd={monthSel.end}
                tasks={tasks}
                reviews={reviews}
                existing={findReview("month", selection.monthKey)}
                onSave={({ content, insights, carryovers }) => {
                  saveReview({
                    period: "month",
                    periodKey: selection.monthKey,
                    periodStart: monthSel.start,
                    periodEnd: monthSel.end,
                    content,
                    insights,
                    carryovers,
                  });
                  flash("月总结已保存");
                }}
              />
            </div>
          ) : null}

          {selection?.type === "week" && weekSel ? (
            <div className="space-y-2">
              <p className="font-display font-semibold text-[var(--ink)]">
                {selection.weekKey} 复盘
              </p>
              <ReviewPanel
                compact
                period="week"
                periodKey={selection.weekKey}
                periodStart={weekSel.start}
                periodEnd={weekSel.end}
                tasks={tasks}
                reviews={reviews}
                existing={findReview("week", selection.weekKey)}
                onSave={({ content, insights, carryovers }) => {
                  saveReview({
                    period: "week",
                    periodKey: selection.weekKey,
                    periodStart: weekSel.start,
                    periodEnd: weekSel.end,
                    content,
                    insights,
                    carryovers,
                  });
                  flash("周总结已保存");
                }}
              />
            </div>
          ) : null}

          {selection?.type === "day" ? (
            <DayAside
              day={selection.day}
              tasks={tasks}
              onPickTask={(taskId, day) =>
                setSelection({ type: "task", taskId, day })
              }
              onAdd={() => setSelection({ type: "add", day: selection.day })}
            />
          ) : null}

          {selection?.type === "add" ? (
            <div className="space-y-2">
              <p className="font-display font-semibold text-[var(--ink)]">
                新建 · {selection.day}
              </p>
              <TaskForm
                defaultStartDate={selection.day}
                defaultEndDate={selection.day}
                defaultColor={nextTaskColor(tasks.map((t) => t.color))}
                compact
                onCancel={() => setSelection(null)}
                onSubmit={(value: TaskFormValue) => {
                  saveTask(value);
                  setExpandedDays((prev) => new Set(prev).add(selection.day));
                  flash("已添加");
                  setSelection(null);
                }}
              />
            </div>
          ) : null}

          {selection?.type === "task" && selectedTask ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {!selectedTask.done && !selectedTask.carriedTo ? (
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--ink)]/[0.07] px-1.5 font-mono text-[11px] font-medium text-[var(--ink-soft)]">
                    {dayTaskSeqMap(tasks, selection.day).get(selectedTask.id) ??
                      "·"}
                  </span>
                ) : null}
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: carriedDisplayColor(selectedTask) }}
                />
                <p className="font-display font-semibold text-[var(--ink)]">
                  {selectedTask.title}
                </p>
                {selectedTask.startDate !== selectedTask.endDate ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: carriedDisplayColor(selectedTask) }}
                  >
                    跨日
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[var(--muted)]">
                {formatDateRange(selectedTask.startDate, selectedTask.endDate)}
              </p>
              {selectedTask.carriedTo ? (
                <p className="text-[11px] font-medium text-[var(--muted)]">
                  未完成 · 已结转到 {selectedTask.carriedTo}（原日留底）
                </p>
              ) : selectedTask.carriedFrom && !selectedTask.done ? (
                <p className="text-[11px] font-medium text-[#b45309]">
                  遗留 · 结转自 {selectedTask.carriedFrom}
                </p>
              ) : null}
              {selectedTask.done ? (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--accent-ink)]">
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-sm"
                    style={{ backgroundColor: carriedDisplayColor(selectedTask) }}
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
                      <path
                        d="M2.5 6.2 L5 8.6 L9.5 3.4"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  已完成 · 再双击可撤销
                </p>
              ) : selectedTask.carriedTo ? null : savedFlash ? (
                <p className="text-[11px] text-[var(--accent-ink)]">已保存</p>
              ) : (
                <p className="text-[11px] text-[var(--muted)]">
                  双击任务圆或跨日框即可完成
                </p>
              )}
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-red-700/90 transition-colors hover:bg-red-50"
                onClick={() => {
                  if (confirm(`删除「${selectedTask.title}」？`)) {
                    removeTask(selectedTask.id);
                    setSelection(null);
                    flash("已删除");
                  }
                }}
              >
                删除
              </button>
              <TaskForm
                key={selectedTask.id}
                defaultStartDate={selectedTask.startDate}
                defaultEndDate={selectedTask.endDate}
                defaultColor={selectedTask.color}
                initial={selectedTask}
                compact
                onCancel={() => setSelection(null)}
                onSubmit={(value) => {
                  saveTask({ ...value, id: selectedTask.id });
                  setSavedFlash(true);
                  window.setTimeout(() => setSavedFlash(false), 1600);
                }}
              />
            </div>
          ) : null}
          </div>

          <BackupPanel />
        </aside>
      </div>
    </div>
  );
}
