"use client";

import { AppShell } from "./AppShell";

export function LoadingState({ title }: { title: string }) {
  return (
    <AppShell title={title} subtitle="正在铺开时间线…">
      <div className="dx-panel relative h-44 overflow-hidden rounded-[var(--radius-panel)]">
        <div className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,transparent_20%,color-mix(in_oklab,white_55%,transparent)_45%,transparent_70%)] bg-[length:200%_100%]" />
        <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-[var(--line-strong)]" />
        <div className="absolute left-[18%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--accent)] bg-[var(--surface-solid)]" />
        <div className="absolute left-[48%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--line-strong)] bg-[var(--surface-solid)]" />
        <div className="absolute left-[78%] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--line-strong)] bg-[var(--surface-solid)]" />
      </div>
    </AppShell>
  );
}
