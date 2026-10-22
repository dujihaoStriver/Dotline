"use client";

import { useEffect, useState } from "react";
import {
  CHANGELOG,
  isWithinShowWindow,
  LATEST_CHANGELOG,
  WHATS_NEW_SEEN_KEY,
} from "@/lib/changelog";

type Mode = "hidden" | "banner" | "button" | "history";

export function WhatsNew() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [hasUnseen, setHasUnseen] = useState(false);

  useEffect(() => {
    try {
      const seen = window.localStorage.getItem(WHATS_NEW_SEEN_KEY);
      const unseen = seen !== LATEST_CHANGELOG.version;
      setHasUnseen(unseen);
      setMode(
        unseen && isWithinShowWindow(LATEST_CHANGELOG.date)
          ? "banner"
          : "button",
      );
    } catch {
      setMode("button");
    }
  }, []);

  function markSeen() {
    try {
      window.localStorage.setItem(WHATS_NEW_SEEN_KEY, LATEST_CHANGELOG.version);
    } catch {
      // localStorage 不可用时仅关闭本次显示
    }
    setHasUnseen(false);
  }

  function dismiss() {
    markSeen();
    setMode("button");
  }

  function closeHistory() {
    markSeen();
    setMode("button");
  }

  if (mode === "hidden") return null;

  if (mode === "button") {
    return (
      <div className="flex shrink-0 justify-end pb-1.5">
        <button
          type="button"
          onClick={() => setMode("history")}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--ink)]"
        >
          {hasUnseen ? (
            <span className="h-1.5 w-1.5 rounded-full bg-[#b45309]" />
          ) : null}
          更新
        </button>
      </div>
    );
  }

  if (mode === "history") {
    return (
      <section className="dx-panel mb-3 shrink-0 rounded-[var(--radius-panel)] px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-sm font-semibold text-[var(--ink)]">
            更新记录
          </p>
          <button
            type="button"
            onClick={closeHistory}
            className="rounded-lg px-2 py-1 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--ink)]"
          >
            关闭
          </button>
        </div>
        <div className="mt-2 space-y-3">
          {CHANGELOG.map((entry) => (
            <div key={entry.version}>
              <p className="text-[11px] font-medium text-[var(--muted)]">
                {entry.version} · {entry.date}
              </p>
              <ul className="mt-1 space-y-1">
                {entry.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-xs leading-relaxed text-[var(--ink-soft)]"
                  >
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // banner：本次更新
  return (
    <section className="dx-panel mb-3 shrink-0 rounded-[var(--radius-panel)] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-sm font-semibold text-[var(--ink)]">
          本次更新
          <span className="ml-2 font-mono text-[11px] font-normal text-[var(--muted)]">
            {LATEST_CHANGELOG.version}
          </span>
        </p>
        <button
          type="button"
          aria-label="关闭更新提示"
          onClick={dismiss}
          className="rounded-md px-1.5 text-sm leading-none text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          ×
        </button>
      </div>
      <ul className="mt-1.5 space-y-1">
        {LATEST_CHANGELOG.items.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-xs leading-relaxed text-[var(--ink-soft)]"
          >
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#b45309]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="dx-btn-primary rounded-lg px-3 py-1.5 text-[11px] font-medium"
        >
          知道了
        </button>
        <button
          type="button"
          onClick={() => setMode("history")}
          className="rounded-lg px-2 py-1.5 text-[11px] text-[var(--muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--ink)]"
        >
          查看更新记录
        </button>
      </div>
    </section>
  );
}
