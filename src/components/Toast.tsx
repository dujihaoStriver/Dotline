"use client";

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="dx-toast pointer-events-none absolute bottom-4 left-1/2 z-10 rounded-full border border-white/10 bg-[var(--ink)]/92 px-4 py-2 text-xs tracking-wide text-white shadow-[0_12px_32px_-16px_rgba(18,26,33,0.65)] backdrop-blur-md">
      {message}
    </div>
  );
}
