"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingState } from "@/components/LoadingState";
import { ReviewPanel } from "@/components/ReviewPanel";
import {
  getMonthKey,
  monthRangeFromKey,
  parseDateKey,
  shiftMonthKey,
} from "@/lib/dates";
import { tasksInRange } from "@/lib/review-draft";
import { useClientNow } from "@/lib/use-client-now";
import { useStore } from "@/lib/use-store";

export default function MonthPage() {
  const { tasks, reviews, saveReview, findReview } = useStore();
  const now = useClientNow();
  const [monthKey, setMonthKey] = useState<string | null>(null);

  useEffect(() => {
    if (now && !monthKey) setMonthKey(getMonthKey(now));
  }, [now, monthKey]);

  const range = monthKey ? monthRangeFromKey(monthKey) : null;
  const existing = monthKey ? findReview("month", monthKey) : undefined;

  const monthTasks = useMemo(() => {
    if (!range) return [];
    return tasksInRange(tasks, range.start, range.end);
  }, [tasks, range]);

  if (!monthKey || !range) return <LoadingState title="本月" />;

  const done = monthTasks.filter((t) => t.done).length;
  const weekReviewCount = reviews.filter((r) => {
    if (r.period !== "week") return false;
    return r.periodStart <= range.end && r.periodEnd >= range.start;
  }).length;

  return (
    <AppShell
      title="本月"
      subtitle={`${monthKey} · 完成 ${done}/${monthTasks.length} · 已有周总结 ${weekReviewCount} 篇`}
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setMonthKey((k) => (k ? shiftMonthKey(k, -1) : k))}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            onClick={() => setMonthKey(getMonthKey(new Date()))}
          >
            本月
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setMonthKey((k) => (k ? shiftMonthKey(k, 1) : k))}
          >
            →
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)]">
          月总结会拉取本月全部任务完成情况，并拼接与本月重叠的周总结心得/结转——不是简单「拼 4
          篇周报」。
        </p>

        <ReviewPanel
          period="month"
          periodKey={monthKey}
          periodStart={range.start}
          periodEnd={range.end}
          tasks={tasks}
          reviews={reviews}
          existing={existing}
          onSave={({ content, insights, carryovers }) => {
            saveReview({
              period: "month",
              periodKey: monthKey,
              periodStart: range.start,
              periodEnd: range.end,
              content,
              insights,
              carryovers,
            });
          }}
        />

        <p className="text-center text-xs text-[var(--muted)]">
          锚定 {parseDateKey(range.start).toLocaleDateString("zh-CN")}
        </p>
      </div>
    </AppShell>
  );
}
