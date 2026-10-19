"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildMonthDraft,
  buildWeekDraft,
  buildYearDraft,
  rebuildContent,
} from "@/lib/review-draft";
import type { Review, ReviewPeriod, Task } from "@/lib/types";

type Props = {
  period: ReviewPeriod;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  tasks: Task[];
  reviews: Review[];
  existing?: Review;
  compact?: boolean;
  onSave: (payload: {
    content: string;
    insights: string;
    carryovers: string;
  }) => void;
};

export function ReviewPanel({
  period,
  periodKey,
  periodStart,
  periodEnd,
  tasks,
  reviews,
  existing,
  compact,
  onSave,
}: Props) {
  const draft = useMemo(() => {
    if (period === "week") return buildWeekDraft(tasks, periodKey, existing);
    if (period === "month")
      return buildMonthDraft(tasks, reviews, periodKey, existing);
    return buildYearDraft(tasks, reviews, periodKey, existing);
  }, [period, periodKey, tasks, reviews, existing]);

  const [insights, setInsights] = useState(
    existing?.insights ?? draft.insights,
  );
  const [carryovers, setCarryovers] = useState(
    existing?.carryovers ?? draft.carryovers,
  );
  const [content, setContent] = useState(existing?.content ?? draft.content);
  const [savedAt, setSavedAt] = useState<string | null>(
    existing?.updatedAt ?? null,
  );

  useEffect(() => {
    setInsights(existing?.insights ?? draft.insights);
    setCarryovers(existing?.carryovers ?? draft.carryovers);
    setContent(existing?.content ?? draft.content);
    setSavedAt(existing?.updatedAt ?? null);
  }, [periodKey, period, existing, draft]);

  function regenerate() {
    const seed = { insights, carryovers };
    const next =
      period === "week"
        ? buildWeekDraft(tasks, periodKey, seed)
        : period === "month"
          ? buildMonthDraft(tasks, reviews, periodKey, seed)
          : buildYearDraft(tasks, reviews, periodKey, seed);
    setContent(next.content);
  }

  function syncFromFields() {
    setContent(rebuildContent(period, periodKey, insights, carryovers, content));
  }

  function handleSave() {
    const nextContent = rebuildContent(
      period,
      periodKey,
      insights,
      carryovers,
      content,
    );
    setContent(nextContent);
    onSave({ content: nextContent, insights, carryovers });
    setSavedAt(new Date().toISOString());
  }

  const label =
    period === "week" ? "周" : period === "month" ? "月" : "年";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          {periodStart} → {periodEnd}
          {savedAt
            ? ` · 已保存 ${new Date(savedAt).toLocaleString("zh-CN")}`
            : " · 尚未保存"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={regenerate}
            className="dx-btn rounded-xl px-3 py-2 text-sm"
          >
            重新生成底稿
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="dx-btn-primary rounded-xl px-3 py-2 text-sm font-medium"
          >
            保存{label}总结
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-[var(--muted)]">
          {label}心得
        </span>
        <textarea
          value={insights}
          onChange={(e) => setInsights(e.target.value)}
          onBlur={syncFromFields}
          rows={compact ? 3 : 4}
          placeholder="这周/月/年学到了什么、哪里可以改进…"
          className="dx-input mt-1 w-full rounded-2xl px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--muted)]">
          未完成 / 结转
        </span>
        <textarea
          value={carryovers}
          onChange={(e) => setCarryovers(e.target.value)}
          onBlur={syncFromFields}
          rows={compact ? 3 : 4}
          placeholder="需要结转到下一周期的事项…"
          className="dx-input mt-1 w-full rounded-2xl px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-[var(--muted)]">
          Markdown 全文（可直接编辑）
        </span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={compact ? 8 : 18}
          className="dx-input mt-1 w-full rounded-2xl px-3 py-3 font-mono text-xs leading-relaxed"
        />
      </label>
    </section>
  );
}
