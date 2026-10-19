/** Distinct task colors — assigned round-robin, stored on each task. */
export const TASK_COLORS = [
  "#0f766e",
  "#b45309",
  "#1d4ed8",
  "#be123c",
  "#7c3aed",
  "#047857",
  "#c2410c",
  "#0369a1",
  "#a16207",
  "#9f1239",
  "#4338ca",
  "#0e7490",
] as const;

export type TaskColor = (typeof TASK_COLORS)[number];

export function nextTaskColor(used: string[]): string {
  const counts = new Map<string, number>();
  for (const c of TASK_COLORS) counts.set(c, 0);
  for (const c of used) {
    if (counts.has(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string = TASK_COLORS[0];
  let bestCount = Infinity;
  for (const c of TASK_COLORS) {
    const n = counts.get(c) ?? 0;
    if (n < bestCount) {
      best = c;
      bestCount = n;
    }
  }
  return best;
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return hex;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
