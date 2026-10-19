"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BackupPanel } from "@/components/BackupPanel";
import { LoadingState } from "@/components/LoadingState";
import { ReviewPanel } from "@/components/ReviewPanel";
import { getYearKey, yearRangeFromKey } from "@/lib/dates";
import { tasksInRange } from "@/lib/review-draft";
import { useClientNow } from "@/lib/use-client-now";
import { useStore } from "@/lib/use-store";

export default function YearPage() {
  const { tasks, reviews, saveReview, findReview } = useStore();
  const now = useClientNow();
  const [yearKey, setYearKey] = useState<string | null>(null);

  useEffect(() => {
    if (now && !yearKey) setYearKey(getYearKey(now));
  }, [now, yearKey]);

  const range = yearKey ? yearRangeFromKey(yearKey) : null;
  const existing = yearKey ? findReview("year", yearKey) : undefined;

  const yearTasks = useMemo(() => {
    if (!range) return [];
    return tasksInRange(tasks, range.start, range.end);
  }, [tasks, range]);

  if (!yearKey || !range) return <LoadingState title="本年" />;

  const done = yearTasks.filter((t) => t.done).length;
  const monthReviewCount = reviews.filter(
    (r) => r.period === "month" && r.periodKey.startsWith(`${yearKey}-`),
  ).length;

  return (
    <AppShell
      title="本年"
      subtitle={`${yearKey} · 完成 ${done}/${yearTasks.length} · 月总结 ${monthReviewCount} 篇`}
      actions={
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setYearKey((y) => (y ? String(Number(y) - 1) : y))}
          >
            ←
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            onClick={() => setYearKey(getYearKey(new Date()))}
          >
            今年
          </button>
          <button
            type="button"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-sm"
            onClick={() => setYearKey((y) => (y ? String(Number(y) + 1) : y))}
          >
            →
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <ReviewPanel
          period="year"
          periodKey={yearKey}
          periodStart={range.start}
          periodEnd={range.end}
          tasks={tasks}
          reviews={reviews}
          existing={existing}
          onSave={({ content, insights, carryovers }) => {
            saveReview({
              period: "year",
              periodKey: yearKey,
              periodStart: range.start,
              periodEnd: range.end,
              content,
              insights,
              carryovers,
            });
          }}
        />

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <BackupPanel />
        </div>
      </div>
    </AppShell>
  );
}
