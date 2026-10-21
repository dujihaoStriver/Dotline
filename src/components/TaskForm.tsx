"use client";

import { useState, type FormEvent } from "react";
import { nextTaskColor, TASK_COLORS } from "@/lib/colors";
import { combineDateAndTime } from "@/lib/dates";
import type { Task, TaskKind } from "@/lib/types";

export type TaskFormValue = {
  title: string;
  note: string;
  kind: TaskKind;
  startDate: string;
  endDate: string;
  color: string;
  startAt: string | null;
  endAt: string | null;
  done: boolean;
  doneAt: string | null;
  carriedFrom: string | null;
  priority?: number;
};

type Props = {
  defaultStartDate: string;
  defaultEndDate?: string;
  defaultColor?: string;
  /** 已有任务颜色，新建提交后自动切到下一个 */
  usedColors?: string[];
  onSubmit: (input: TaskFormValue) => void;
  initial?: Task | null;
  onCancel?: () => void;
  compact?: boolean;
};

export function TaskForm({
  defaultStartDate,
  defaultEndDate,
  defaultColor,
  usedColors = [],
  onSubmit,
  initial,
  onCancel,
  compact,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<TaskKind>(initial?.kind ?? "all_day");
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? defaultStartDate,
  );
  const [endDate, setEndDate] = useState(
    initial?.endDate ?? defaultEndDate ?? defaultStartDate,
  );
  const [color, setColor] = useState(
    initial?.color ?? defaultColor ?? TASK_COLORS[0],
  );
  const [startTime, setStartTime] = useState(
    initial?.startAt
      ? new Date(initial.startAt).toTimeString().slice(0, 5)
      : "09:00",
  );
  const [endTime, setEndTime] = useState(
    initial?.endAt
      ? new Date(initial.endAt).toTimeString().slice(0, 5)
      : "10:00",
  );
  const [note, setNote] = useState(initial?.note ?? "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const safeEnd = endDate >= startDate ? endDate : startDate;
    const usedColor = color;
    onSubmit({
      title,
      note,
      kind,
      startDate,
      endDate: safeEnd,
      color: usedColor,
      startAt:
        kind === "timed" ? combineDateAndTime(startDate, startTime) : null,
      endAt: kind === "timed" ? combineDateAndTime(safeEnd, endTime) : null,
      done: initial?.done ?? false,
      doneAt: initial?.doneAt ?? null,
      carriedFrom: initial?.carriedFrom ?? null,
      priority: initial?.priority,
    });
    if (!initial) {
      setTitle("");
      setNote("");
      setColor(nextTaskColor([...usedColors, usedColor]));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-[var(--radius-panel)] p-4 ${
        compact ? "dx-panel-solid" : "dx-panel"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="inline-flex rounded-xl bg-[var(--chip)]/80 p-0.5">
        <button
          type="button"
          onClick={() => setKind("all_day")}
          className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
            kind === "all_day"
              ? "bg-[var(--ink)] text-[var(--surface-solid)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          日期任务
        </button>
        <button
          type="button"
          onClick={() => setKind("timed")}
          className={`rounded-lg px-3 py-1.5 text-xs transition-all ${
            kind === "timed"
              ? "bg-[var(--ink)] text-[var(--surface-solid)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--ink)]"
          }`}
        >
          含具体时刻
        </button>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="任务名称…"
        className="dx-input mt-3 w-full rounded-xl px-3 py-2.5 text-[var(--ink)]"
      />

      <div
        className={`mt-3 grid gap-3 ${
          compact ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        <label className="min-w-0 text-xs text-[var(--muted)]">
          开始日期
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (endDate < e.target.value) setEndDate(e.target.value);
            }}
            className="dx-input dx-input-date mt-1 w-full min-w-0 rounded-xl px-2.5 py-2 text-sm"
          />
        </label>
        <label className="min-w-0 text-xs text-[var(--muted)]">
          结束日期
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="dx-input dx-input-date mt-1 w-full min-w-0 rounded-xl px-2.5 py-2 text-sm"
          />
        </label>
      </div>

      {kind === "timed" ? (
        <div
          className={`mt-3 grid gap-3 ${
            compact ? "grid-cols-1" : "grid-cols-2"
          }`}
        >
          <label className="min-w-0 text-xs text-[var(--muted)]">
            开始时刻
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="dx-input dx-input-date mt-1 w-full min-w-0 rounded-xl px-2.5 py-2 text-sm"
            />
          </label>
          <label className="min-w-0 text-xs text-[var(--muted)]">
            结束时刻
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="dx-input dx-input-date mt-1 w-full min-w-0 rounded-xl px-2.5 py-2 text-sm"
            />
          </label>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-xs text-[var(--muted)]">任务颜色</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TASK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`颜色 ${c}`}
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full transition-transform duration-150 ${
                color === c
                  ? "scale-110 ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]"
                  : "opacity-80 hover:scale-105 hover:opacity-100"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        rows={2}
        className="dx-input mt-3 w-full resize-none rounded-xl px-3 py-2 text-sm"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="dx-btn-primary rounded-xl px-4 py-2 text-sm font-medium"
        >
          {initial ? "保存" : "添加"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="dx-btn rounded-xl px-4 py-2 text-sm"
          >
            取消
          </button>
        ) : null}
      </div>
    </form>
  );
}
