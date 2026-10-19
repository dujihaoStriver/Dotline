"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
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
