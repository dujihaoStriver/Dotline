"use client";

import { useState } from "react";
import { colorWithAlpha } from "@/lib/colors";
import { formatDateRange, formatShortDate, formatTime } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { TaskForm, type TaskFormValue } from "./TaskForm";

type Props = {
  task: Task;
  /** 1-based day order among incomplete tasks; hide when done */
  seq?: number;
  /** Stagger index for list entrance */
  index?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, value: TaskFormValue) => void;
};

export function ExpandableTask({
  task,
  seq,
  index = 0,
  onToggle,
  onDelete,
  onSave,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const multiDay = task.startDate !== task.endDate;
  const carriedAway = Boolean(task.carriedTo);

  return (
    <div
      className="dx-task-list-item overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow-soft)] transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
      style={{
        background: colorWithAlpha(
          task.color,
          task.done || carriedAway ? 0.05 : 0.1,
        ),
        borderLeftWidth: 3,
        borderLeftColor: task.color,
        ["--dx-delay" as string]: `${Math.min(index, 12) * 45}ms`,
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!carriedAway) onToggle(task.id);
      }}
    >
      <div className="flex w-full items-start gap-2 px-3.5 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span
            className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px]"
            style={{
              backgroundColor: open ? task.color : "transparent",
              borderColor: task.color,
              color: open ? "#fff" : task.color,
            }}
            aria-hidden
          >
            {open ? "▾" : "▸"}
          </span>

          <span className="min-w-0 flex-1">
            <span
              className={`block text-sm font-medium text-[var(--ink)] ${
                task.done || carriedAway ? "line-through opacity-60" : ""
              }`}
            >
              {!task.done && !carriedAway && seq != null ? (
                <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--ink)]/[0.07] px-1 font-mono text-[11px] font-medium text-[var(--ink-soft)]">
                  {seq}
                </span>
              ) : null}
              {task.title}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted)]">
              <span>{formatDateRange(task.startDate, task.endDate)}</span>
              {multiDay ? (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white"
                  style={{ backgroundColor: task.color }}
                >
                  跨日
                </span>
              ) : null}
              {task.carriedTo ? (
                <span className="rounded-md bg-[var(--chip)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  已结转到 {formatShortDate(task.carriedTo)}
                </span>
              ) : task.carriedFrom ? (
                <span className="rounded-md bg-[#b45309]/12 px-1.5 py-0.5 text-[10px] font-medium text-[#b45309]">
                  昨未完 · 自 {formatShortDate(task.carriedFrom)}
                </span>
              ) : null}
              {task.kind === "timed" ? (
                <span className="font-mono">
                  {formatTime(task.startAt)}–{formatTime(task.endAt)}
                </span>
              ) : null}
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-checked={task.done}
          aria-label={
            carriedAway
              ? "已结转，原日留底"
              : task.done
                ? "标记为未完成"
                : "标记为完成"
          }
          role="checkbox"
          disabled={carriedAway}
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200 disabled:cursor-default disabled:opacity-40"
          style={{
            borderColor: task.color,
            backgroundColor: task.done ? task.color : "transparent",
            boxShadow: task.done
              ? `0 0 0 3px ${colorWithAlpha(task.color, 0.18)}`
              : undefined,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!carriedAway) onToggle(task.id);
          }}
        >
          {carriedAway ? (
            <span className="text-[10px] text-[var(--muted)]">→</span>
          ) : task.done ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M2.5 6.2 L5 8.6 L9.5 3.4"
                fill="none"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
            {task.note ? (
              <p className="text-sm leading-relaxed text-[var(--ink)]">
                {task.note}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">暂无备注</p>
            )}

            <p className="text-[11px] text-[var(--muted)]">
              {carriedAway
                ? `未完成 · 已结转到 ${task.carriedTo}，此为原日留底`
                : task.done
                  ? "已完成 · 再双击可改回"
                  : "双击卡片标记完成"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="dx-btn rounded-lg px-3 py-1.5 text-xs"
              >
                {editing ? "收起编辑" : "编辑"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`删除「${task.title}」？`)) onDelete(task.id);
                }}
                className="rounded-lg px-3 py-1.5 text-xs text-red-700/90 transition-colors hover:bg-red-50"
              >
                删除
              </button>
            </div>

            {editing ? (
              <TaskForm
                defaultStartDate={task.startDate}
                defaultEndDate={task.endDate}
                defaultColor={task.color}
                initial={task}
                compact
                onCancel={() => setEditing(false)}
                onSubmit={(value) => {
                  onSave(task.id, value);
                  setEditing(false);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
