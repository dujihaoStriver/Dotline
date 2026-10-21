"use client";

import { useEffect, useState, type FormEvent } from "react";
import { nextTaskColor, TASK_COLORS } from "@/lib/colors";

type Props = {
  defaultStart: string;
  defaultColor: string;
  /** 已有任务颜色，添加后据此自动切到下一个颜色 */
  usedColors?: string[];
  emptyHint?: boolean;
  onAdd: (input: {
    title: string;
    startDate: string;
    endDate: string;
    color: string;
  }) => void;
};

export function QuickAddBar({
  defaultStart,
  defaultColor,
  usedColors = [],
  emptyHint,
  onAdd,
}: Props) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultStart);
  const [color, setColor] = useState(defaultColor);

  useEffect(() => {
    setStartDate(defaultStart);
    setEndDate(defaultStart);
  }, [defaultStart]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const safeEnd = endDate >= startDate ? endDate : startDate;
    const usedColor = color;
    onAdd({
      title: title.trim(),
      startDate,
      endDate: safeEnd,
      color: usedColor,
    });
    setTitle("");
    setStartDate(defaultStart);
    setEndDate(defaultStart);
    // 连续添加时自动换色：把刚用过的颜色计入，再选使用次数最少的
    setColor(nextTaskColor([...usedColors, usedColor]));
  }

  return (
    <form
      onSubmit={submit}
      className="dx-panel flex shrink-0 flex-col gap-2.5 rounded-[var(--radius-panel)] px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={
          emptyHint ? "在这里记第一件事，回车添加" : "记一件事，回车添加"
        }
        className="dx-input min-w-0 flex-1 rounded-xl px-3.5 py-2.5 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            if (endDate < e.target.value) setEndDate(e.target.value);
          }}
          className="dx-input rounded-xl px-2.5 py-1.5 text-xs"
        />
        <span className="text-[11px] text-[var(--muted)]">至</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="dx-input rounded-xl px-2.5 py-1.5 text-xs"
        />
        <div className="flex items-center gap-1.5 rounded-full bg-[var(--chip)]/70 px-1.5 py-1">
          {TASK_COLORS.slice(0, 8).map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`颜色 ${c}`}
              onClick={() => setColor(c)}
              className={`h-[18px] w-[18px] rounded-full transition-transform duration-150 ${
                color === c
                  ? "scale-110 ring-2 ring-[var(--ink)] ring-offset-1 ring-offset-[var(--surface)]"
                  : "opacity-80 hover:opacity-100"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          type="submit"
          className="dx-btn-primary rounded-xl px-3.5 py-1.5 text-xs font-medium"
        >
          添加
        </button>
      </div>
    </form>
  );
}
