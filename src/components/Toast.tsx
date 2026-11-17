"use client";

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="dx-toast pointer-events-none fixed left-1/2 z-30 max-w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[var(--ink)]/92 px-4 py-2.5 text-center text-xs leading-relaxed tracking-wide text-white shadow-[0_12px_32px_-16px_rgba(18,26,33,0.65)] backdrop-blur-md"
      style={{
        bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {message}
    </div>
  );
}
