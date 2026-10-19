"use client";

import { useStore } from "@/lib/use-store";

export function BackupPanel() {
  const { exportJson, importJson, clearAll } = useStore();

  return (
    <section className="border-t border-[var(--line)] pt-3.5">
      <h3 className="text-xs font-semibold tracking-wide text-[var(--ink)]">
        数据备份
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">
        数据只存在当前浏览器地址下。
        <span className="text-[var(--ink-soft)]">
          localhost 与 127.0.0.1 彼此隔离
        </span>
        ，换地址会像「任务没了」。换电脑/清站点数据前请先导出。
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs text-white transition-opacity hover:opacity-90"
          onClick={() => {
            const blob = new Blob([exportJson()], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dianxian-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          导出
        </button>
        <label className="dx-btn cursor-pointer rounded-lg px-2.5 py-1.5 text-xs">
          导入
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              importJson(await file.text());
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          className="rounded-lg px-2.5 py-1.5 text-xs text-red-700/90 transition-colors hover:bg-red-50"
          onClick={() => {
            if (confirm("确认清空本机全部任务与总结？此操作不可撤销。")) {
              clearAll();
            }
          }}
        >
          清空
        </button>
      </div>
    </section>
  );
}
