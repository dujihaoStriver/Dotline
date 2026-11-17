"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDayCarryOver } from "@/lib/use-store";
import { WhatsNew } from "./WhatsNew";

const nav = [
  { href: "/", label: "脉络" },
  { href: "/today", label: "今日" },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Full-viewport canvas layout for graph views */
  wide?: boolean;
}) {
  useDayCarryOver();
  const pathname = usePathname();
  const activeIndex = nav.findIndex((item) =>
    item.href === "/"
      ? pathname === "/"
      : pathname.startsWith(item.href),
  );
  const pillIndex = activeIndex < 0 ? 0 : activeIndex;

  return (
    <div
      className={
        wide
          ? // 手机可整页下滑看到侧栏导出；大屏仍锁视口做双栏
            "flex min-h-dvh w-full flex-col overflow-y-auto px-3 pb-[calc(11rem+env(safe-area-inset-bottom,0px))] pt-3 sm:px-5 lg:h-dvh lg:max-h-dvh lg:overflow-hidden lg:pb-4"
          : "mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-[calc(11rem+env(safe-area-inset-bottom,0px))] pt-7 sm:px-6"
      }
    >
      <header
        className={`dx-rise flex shrink-0 items-start justify-between gap-4 ${
          wide ? "mb-3" : "mb-7"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <p
              className={`dx-brand-mark font-display font-semibold tracking-tight text-[var(--ink)] ${
                wide ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"
              }`}
            >
              点线
            </p>
            <span className="hidden h-4 w-px bg-[var(--line-strong)] sm:block" />
            <h1
              className={`truncate font-display text-[var(--ink-soft)] ${
                wide
                  ? "text-sm font-medium tracking-[0.08em] sm:text-base"
                  : "text-base font-medium tracking-[0.06em] sm:text-lg"
              }`}
            >
              {title}
            </h1>
          </div>
          {subtitle ? (
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>

      <main
        className={`dx-fade-in min-h-0 ${
          wide ? "flex flex-1 flex-col lg:min-h-0" : "flex-1"
        }`}
      >
        <WhatsNew />
        {children}
      </main>

      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-4 sm:pb-4">
        <div
          className={`pointer-events-auto dx-panel relative mx-auto grid w-full grid-cols-2 gap-1 rounded-2xl p-1.5 ${
            wide ? "max-w-md" : "max-w-sm"
          }`}
        >
          <div
            aria-hidden
            className="dx-nav-pill absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-xl bg-[var(--ink)] shadow-[0_8px_20px_-12px_rgba(18,26,33,0.55)]"
            style={{
              transform: `translateX(calc(${pillIndex} * (100% + 0.25rem)))`,
            }}
          />
          {nav.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative z-10 rounded-xl px-3 py-2.5 text-center text-sm transition-colors duration-200 ${
                  active
                    ? "font-medium text-[var(--surface-solid)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
