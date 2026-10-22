"use client";

import { CARRIED_OVER_COLOR, nextTaskColor, TASK_COLORS } from "./colors";
import { createId } from "./id";
import type { Review, StoreSnapshot, Task } from "./types";

const STORAGE_KEY = "dianxian.v1";

const empty: StoreSnapshot = { tasks: [], reviews: [] };

type Listener = () => void;

let memoryCache: StoreSnapshot | null = null;
const listeners = new Set<Listener>();
/** 本会话已对哪一天跑过结转，避免重复写盘 */
let carriedForDay: string | null = null;

/** 把 ISO 时刻挪到新日期，保留时分秒 */
function shiftIsoToDate(iso: string | null, dateKey: string): string | null {
  if (!iso) return null;
  const prev = new Date(iso);
  if (Number.isNaN(prev.getTime())) return iso;
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(
    y,
    m - 1,
    d,
    prev.getHours(),
    prev.getMinutes(),
    prev.getSeconds(),
    prev.getMilliseconds(),
  );
  return next.toISOString();
}

type LegacyTask = Partial<Task> & {
  id?: string;
  title?: string;
  date?: string;
};

function normalizeTask(raw: LegacyTask, usedColors: string[], index: number): Task | null {
  if (!raw || typeof raw.title !== "string") return null;
  const startDate = raw.startDate || raw.date;
  if (!startDate) return null;
  const endDate =
    raw.endDate && raw.endDate >= startDate ? raw.endDate : startDate;
  const color =
    raw.color && TASK_COLORS.includes(raw.color as (typeof TASK_COLORS)[number])
      ? raw.color
      : nextTaskColor(usedColors);
  usedColors.push(color);

  const now = new Date().toISOString();
  const createdAt = raw.createdAt ?? now;
  return {
    id: raw.id || createId(),
    title: raw.title.trim(),
    note: raw.note ?? "",
    kind: raw.kind === "timed" ? "timed" : "all_day",
    startDate,
    endDate,
    color,
    startAt: raw.startAt ?? null,
    endAt: raw.endAt ?? null,
    done: Boolean(raw.done),
    doneAt: raw.doneAt ?? null,
    carriedFrom: raw.carriedFrom ?? null,
    carriedTo: raw.carriedTo ?? null,
    priority:
      typeof raw.priority === "number" && Number.isFinite(raw.priority)
        ? raw.priority
        : index,
    createdAt,
    updatedAt: raw.updatedAt ?? now,
  };
}

function readRaw(): StoreSnapshot {
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as {
      tasks?: LegacyTask[];
      reviews?: Review[];
    };
    const usedColors: string[] = [];
    const legacy = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const tasks = legacy
      .map((t, i) => normalizeTask(t, usedColors, i))
      .filter((t): t is Task => Boolean(t))
      .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
      .map((t, i) => ({ ...t, priority: i }));
    return {
      tasks,
      reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
    };
  } catch {
    return empty;
  }
}

function writeRaw(next: StoreSnapshot): void {
  memoryCache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

function getSnapshot(): StoreSnapshot {
  if (!memoryCache) memoryCache = readRaw();
  return memoryCache;
}

export function subscribeStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStoreSnapshot(): StoreSnapshot {
  return getSnapshot();
}

export function listTasks(): Task[] {
  return getSnapshot().tasks;
}

/**
 * 未完成的「单日」待办：结束日早于今天 →
 * 原日在原地留底（carriedTo=今天，不再操作），今天新建一条副本继续做。
 * 副本 carriedFrom 记最初安排日；跨日/长期与已留底的不处理。
 * @returns 结转条数
 */
export function carryOverIncompleteDayTasks(todayKey: string): number {
  if (!todayKey || carriedForDay === todayKey) return 0;
  const snap = getSnapshot();
  const now = new Date().toISOString();
  let nextPrio =
    snap.tasks.length > 0
      ? Math.max(...snap.tasks.map((t) => t.priority)) + 1
      : 0;

  const copies: Task[] = [];
  const tasks = snap.tasks.map((t) => {
    // 仅单日、未完成、未留底、已过期
    if (t.done || t.carriedTo) return t;
    if (t.startDate !== t.endDate) return t;
    if (t.endDate >= todayKey) return t;

    copies.push({
      ...t,
      id: createId(),
      color: CARRIED_OVER_COLOR,
      carriedFrom: t.carriedFrom ?? t.startDate,
      carriedTo: null,
      startDate: todayKey,
      endDate: todayKey,
      startAt: shiftIsoToDate(t.startAt, todayKey),
      endAt: shiftIsoToDate(t.endAt, todayKey),
      priority: nextPrio++,
      createdAt: now,
      updatedAt: now,
    });
    // 原日留底
    return { ...t, carriedTo: todayKey, updatedAt: now };
  });

  carriedForDay = todayKey;
  if (copies.length > 0) writeRaw({ ...snap, tasks: [...tasks, ...copies] });
  return copies.length;
}

export function listReviews(): Review[] {
  return getSnapshot().reviews;
}

/** 新任务追加到末尾，按添加顺序排列（值越大越靠后） */
function nextPriority(tasks: Task[]): number {
  if (!tasks.length) return 0;
  return Math.max(...tasks.map((t) => t.priority)) + 1;
}

export function upsertTask(
  input: Omit<Task, "id" | "createdAt" | "updatedAt" | "priority"> & {
    id?: string;
    priority?: number;
  },
): Task {
  const now = new Date().toISOString();
  const snap = getSnapshot();
  const existing = input.id
    ? snap.tasks.find((t) => t.id === input.id)
    : undefined;

  const startDate = input.startDate;
  const endDate = input.endDate >= startDate ? input.endDate : startDate;
  const color =
    input.color ||
    existing?.color ||
    nextTaskColor(snap.tasks.map((t) => t.color));

  const task: Task = {
    id: existing?.id ?? createId(),
    title: input.title.trim(),
    note: input.note ?? "",
    kind: input.kind,
    startDate,
    endDate,
    color,
    startAt: input.startAt,
    endAt: input.endAt,
    done: input.done,
    doneAt: input.doneAt,
    carriedFrom: input.carriedFrom ?? null,
    carriedTo: input.carriedTo ?? existing?.carriedTo ?? null,
    priority:
      typeof input.priority === "number"
        ? input.priority
        : (existing?.priority ?? nextPriority(snap.tasks)),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const tasks = existing
    ? snap.tasks.map((t) => (t.id === task.id ? task : t))
    : [...snap.tasks, task];

  writeRaw({ ...snap, tasks });
  return task;
}

/** Move dragId to sit before targetId (or to end if targetId is null). */
export function moveTaskBefore(dragId: string, targetId: string | null): void {
  if (dragId === targetId) return;
  const snap = getSnapshot();
  const ordered = [...snap.tasks].sort(
    (a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt),
  );
  const from = ordered.findIndex((t) => t.id === dragId);
  if (from < 0) return;
  const [item] = ordered.splice(from, 1);
  let to =
    targetId == null ? ordered.length : ordered.findIndex((t) => t.id === targetId);
  if (to < 0) to = ordered.length;
  ordered.splice(to, 0, item);

  const now = new Date().toISOString();
  const rank = new Map(ordered.map((t, i) => [t.id, i]));
  writeRaw({
    ...snap,
    tasks: snap.tasks.map((t) => ({
      ...t,
      priority: rank.get(t.id) ?? t.priority,
      updatedAt: rank.has(t.id) ? now : t.updatedAt,
    })),
  });
}

export function toggleTaskDone(id: string): Task | null {
  const snap = getSnapshot();
  const task = snap.tasks.find((t) => t.id === id);
  if (!task) return null;
  // 原日留底已结转走，不再切换完成状态
  if (task.carriedTo) return task;
  const done = !task.done;
  return upsertTask({
    ...task,
    done,
    doneAt: done ? new Date().toISOString() : null,
  });
}

export function deleteTask(id: string): void {
  const snap = getSnapshot();
  writeRaw({ ...snap, tasks: snap.tasks.filter((t) => t.id !== id) });
}

export function upsertReview(
  input: Omit<Review, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Review {
  const now = new Date().toISOString();
  const snap = getSnapshot();
  const existing =
    (input.id && snap.reviews.find((r) => r.id === input.id)) ||
    snap.reviews.find(
      (r) => r.period === input.period && r.periodKey === input.periodKey,
    );

  const review: Review = {
    id: existing?.id ?? createId(),
    period: input.period,
    periodKey: input.periodKey,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    content: input.content,
    insights: input.insights,
    carryovers: input.carryovers,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const reviews = existing
    ? snap.reviews.map((r) => (r.id === review.id ? review : r))
    : [...snap.reviews, review];

  writeRaw({ ...snap, reviews });
  return review;
}

export function getReview(
  period: Review["period"],
  periodKey: string,
): Review | undefined {
  return getSnapshot().reviews.find(
    (r) => r.period === period && r.periodKey === periodKey,
  );
}

export function exportJson(): string {
  return JSON.stringify(getSnapshot(), null, 2);
}

export function importJson(raw: string): void {
  const parsed = JSON.parse(raw) as { tasks?: LegacyTask[]; reviews?: Review[] };
  const usedColors: string[] = [];
  const legacy = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  const tasks = legacy
    .map((t, i) => normalizeTask(t, usedColors, i))
    .filter((t): t is Task => Boolean(t))
    .sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt))
    .map((t, i) => ({ ...t, priority: i }));
  carriedForDay = null;
  writeRaw({
    tasks,
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
  });
}

export function clearAll(): void {
  carriedForDay = null;
  writeRaw(empty);
}
