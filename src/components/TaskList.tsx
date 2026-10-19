"use client";

import type { Task } from "@/lib/types";
import { ExpandableTask } from "./ExpandableTask";
import type { TaskFormValue } from "./TaskForm";

type Props = {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, value: TaskFormValue) => void;
  emptyText?: string;
};

/** @deprecated Prefer ExpandableTask list; kept for thin wrappers. */
export function TaskList({
  tasks,
  onToggle,
  onDelete,
  onSave,
  emptyText = "这一天还没有任务",
}: Props) {
  if (!tasks.length) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li key={task.id}>
          <ExpandableTask
            task={task}
            onToggle={onToggle}
            onDelete={onDelete}
            onSave={onSave}
          />
        </li>
      ))}
    </ul>
  );
}
