"use client";

import { nextTaskColor, TASK_COLORS } from "./colors";
import { createId } from "./id";
import type { Review, StoreSnapshot, Task } from "./types";

const STORAGE_KEY = "dianxian.v1";

const empty: StoreSnapshot = { tasks: [], reviews: [] };

type Listener = () => void;

let memoryCache: StoreSnapshot | null = null;
const listeners = new Set<Listener>();

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
  writeRaw({
    tasks,
    reviews: Array.isArray(parsed.reviews) ? parsed.reviews : [],
  });
}

export function clearAll(): void {
  writeRaw(empty);
}
