"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { toDateKey } from "./dates";
import {
  carryOverIncompleteDayTasks,
  clearAll,
  deleteTask,
  exportJson,
  getReview,
  getStoreSnapshot,
  importJson,
  moveTaskBefore,
  subscribeStore,
  toggleTaskDone,
  upsertReview,
  upsertTask,
} from "./storage";
import type { Review, Task } from "./types";

/** 进入任意页面时：把过期未完成的单日待办结转到今天（跨午夜也会再跑） */
export function useDayCarryOver() {
  useEffect(() => {
    const run = () => carryOverIncompleteDayTasks(toDateKey(new Date()));
    run();
    const id = window.setInterval(run, 60_000);
    return () => window.clearInterval(id);
  }, []);
}

export function useStore() {
  const snapshot = useSyncExternalStore(
    subscribeStore,
    getStoreSnapshot,
    getStoreSnapshot,
  );

  const saveTask = useCallback(
    (input: Parameters<typeof upsertTask>[0]) => upsertTask(input),
    [],
  );
  const removeTask = useCallback((id: string) => deleteTask(id), []);
  const toggleDone = useCallback((id: string) => toggleTaskDone(id), []);
  const reorderTask = useCallback(
    (dragId: string, beforeId: string | null) => moveTaskBefore(dragId, beforeId),
    [],
  );
  const saveReview = useCallback(
    (input: Parameters<typeof upsertReview>[0]) => upsertReview(input),
    [],
  );
  const findReview = useCallback(
    (period: Review["period"], periodKey: string) =>
      getReview(period, periodKey),
    [],
  );

  return {
    tasks: snapshot.tasks as Task[],
    reviews: snapshot.reviews as Review[],
    saveTask,
    removeTask,
    toggleDone,
    reorderTask,
    saveReview,
    findReview,
    exportJson,
    importJson,
    clearAll,
  };
}
