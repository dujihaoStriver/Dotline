"use client";

import { useEffect, useState } from "react";
import {
  getMonthKey,
  getWeekKey,
  getYearKey,
  toDateKey,
} from "./dates";

/** Defer "now" to the client to satisfy Next.js prerender rules. */
export function useClientNow() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  return now;
}

export function useClientDateKey() {
  const now = useClientNow();
  return now ? toDateKey(now) : null;
}

export function useClientWeekKey() {
  const now = useClientNow();
  return now ? getWeekKey(now) : null;
}

export function useClientMonthKey() {
  const now = useClientNow();
  return now ? getMonthKey(now) : null;
}

export function useClientYearKey() {
  const now = useClientNow();
  return now ? getYearKey(now) : null;
}
