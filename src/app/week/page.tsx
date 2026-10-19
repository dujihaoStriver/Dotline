"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { ReviewPanel } from "@/components/ReviewPanel";
import {
  addDays,
  eachDateKey,
  formatShortDate,
  getWeekKey,
  startOfWeekMonday,
  toDateKey,
  weekRangeFromKey,
  weekdayLabel,
} from "@/lib/dates";
import { taskOnDay, tasksInRange } from "@/lib/review-draft";
import { useClientNow } from "@/lib/use-client-now";
import { useStore } from "@/lib/use-store";

export default function WeekPage() {
  const { tasks, reviews, saveReview, findReview } = useStore();
  const now = useClientNow();
  const [anchor, setAnchor] = useState<Date | null>(null);

  useEffect(() => {
    if (now && !anchor) setAnchor(now);
  }, [now, anchor]);

  const weekKey = anchor ? getWeekKey(anchor) : null;
  const range = weekKey ? weekRangeFromKey(weekKey) : null;
  const existing = weekKey ? findReview("week", weekKey) : undefined;

  const weekTasks = useMemo(() => {
    if (!range) return [];
    return tasksInRange(tasks, range.start, range.end);
  }, [tasks, range]);

  const byDay = useMemo(() => {
    if (!range) return [];
    return eachDateKey(range.start, range.end).map((date) => ({
      date,
      tasks: weekTasks.filter((t) => taskOnDay(t, date)),
    }));
  }, [weekTasks, range]);

  if (!anchor || !weekKey || !range) return <LoadingState title="本周" />;

  const done = weekTasks.filter((t) => t.done).length;

  return (
    <AppShell
      title="本周"
      subtitle={`${weekKey} · ${formatShortDate(range.start)} – ${formatShortDate(range.end)} · 完成 ${done}/${weekTasks.length}`}
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setAnchor((d) => (d ? addDays(d, -7) : d))}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            onClick={() => setAnchor(new Date())}
          >
            本周
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setAnchor((d) => (d ? addDays(d, 7) : d))}
          >
            →
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <section className="space-y-3">
          {byDay.map(({ date, tasks: dayTasks }) => (
            <div
              key={date}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-[var(--ink)]">
                  {formatShortDate(date)} · {weekdayLabel(date)}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {dayTasks.filter((t) => t.done).length}/{dayTasks.length}
                </span>
              </div>
              {dayTasks.length ? (
                <ul className="space-y-1.5 text-sm text-[var(--muted)]">
                  {dayTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className={t.done ? "line-through" : ""}>
                        {t.done ? "✓ " : ""}
                        {t.title}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--muted)]">无任务</p>
              )}
            </div>
          ))}
        </section>

        <ReviewPanel
          period="week"
          periodKey={weekKey}
          periodStart={range.start}
          periodEnd={range.end}
          tasks={tasks}
          reviews={reviews}
          existing={existing}
          onSave={({ content, insights, carryovers }) => {
            saveReview({
              period: "week",
              periodKey: weekKey,
              periodStart: range.start,
              periodEnd: range.end,
              content,
              insights,
              carryovers,
            });
          }}
        />

        <p className="text-center text-xs text-[var(--muted)]">
          周一为一周起始 · 锚定日 {toDateKey(startOfWeekMonday(anchor))}
        </p>
      </div>
    </AppShell>
  );
}
