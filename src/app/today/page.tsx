"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ExpandableTask } from "@/components/ExpandableTask";
import { LoadingState } from "@/components/LoadingState";
import { TaskForm, type TaskFormValue } from "@/components/TaskForm";
import { nextTaskColor } from "@/lib/colors";
import { shiftDateKey, toDateKey, weekdayLabel } from "@/lib/dates";
import { splitDayTasks } from "@/lib/review-draft";
import type { Task } from "@/lib/types";
import { useClientNow } from "@/lib/use-client-now";
import { useStore } from "@/lib/use-store";

function TaskSection({
  title,
  hint,
  tasks,
  onToggle,
  onDelete,
  onSave,
  emptyText,
}: {
  title: string;
  hint?: string;
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, value: TaskFormValue) => void;
  emptyText: string;
}) {
  const openCount = tasks.filter((t) => !t.done).length;
  const seqById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const t of tasks) {
      if (t.done) continue;
      n += 1;
      map.set(t.id, n);
    }
    return map;
  }, [tasks]);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="font-display text-sm font-semibold tracking-tight text-[var(--ink)]">
          {title}
          <span className="ml-1.5 font-mono text-[11px] font-normal text-[var(--muted)]">
            {openCount}/{tasks.length}
          </span>
        </h2>
        {hint ? (
          <p className="text-[11px] text-[var(--muted)]">{hint}</p>
        ) : null}
      </div>
      {tasks.length ? (
        <div className="space-y-2">
          {tasks.map((task, i) => (
            <ExpandableTask
              key={task.id}
              task={task}
              seq={seqById.get(task.id)}
              index={i}
              onToggle={onToggle}
              onDelete={onDelete}
              onSave={onSave}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          {emptyText}
        </p>
      )}
    </section>
  );
}

export default function TodayPage() {
  const { tasks, saveTask, removeTask, toggleDone } = useStore();
  const now = useClientNow();
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (now && !date) setDate(toDateKey(now));
  }, [now, date]);

  const { dayTasks, longTasks } = useMemo(() => {
    if (!date) return { dayTasks: [], longTasks: [] };
    return splitDayTasks(tasks, date);
  }, [tasks, date]);

  if (!date) return <LoadingState title="今日" />;

  const total = dayTasks.length + longTasks.length;
  const doneCount =
    dayTasks.filter((t) => t.done).length +
    longTasks.filter((t) => t.done).length;

  return (
    <AppShell
      title="今日"
      subtitle={`${date} · ${weekdayLabel(date)} · 完成 ${doneCount}/${total}`}
      actions={
        <div className="dx-panel flex items-center gap-0.5 rounded-xl p-0.5">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:bg-[var(--chip)]"
            onClick={() => setDate((d) => (d ? shiftDateKey(d, -1) : d))}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] transition-colors hover:bg-[var(--chip)]"
            onClick={() => setDate(toDateKey(new Date()))}
          >
            今天
          </button>
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink-soft)] transition-colors hover:bg-[var(--chip)]"
            onClick={() => setDate((d) => (d ? shiftDateKey(d, 1) : d))}
          >
            →
          </button>
        </div>
      }
    >
      <div className="dx-rise space-y-5">
        <TaskForm
          defaultStartDate={date}
          defaultEndDate={date}
          defaultColor={nextTaskColor(tasks.map((t) => t.color))}
          onSubmit={(input) => saveTask(input)}
        />

        <TaskSection
          title="当日任务"
          hint="起止同一天"
          tasks={dayTasks}
          onToggle={toggleDone}
          onDelete={removeTask}
          onSave={(id, value) => saveTask({ ...value, id })}
          emptyText="今天还没有单日安排。在上方填写，结束日保持同一天即可。"
        />

        <TaskSection
          title="长期任务"
          hint="跨日进行中"
          tasks={longTasks}
          onToggle={toggleDone}
          onDelete={removeTask}
          onSave={(id, value) => saveTask({ ...value, id })}
          emptyText="没有覆盖今天的跨日任务。把结束日设晚于开始日，就会出现在这里。"
        />
      </div>
    </AppShell>
  );
}
