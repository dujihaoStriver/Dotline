"use client";

import { useEffect, useState } from "react";
import {
  gistHtmlUrl,
  loadGithubSyncSettings,
  pullSnapshotFromGist,
  pushSnapshotToGist,
  saveGithubGistId,
  saveGithubToken,
} from "@/lib/github-sync";
import { useStore } from "@/lib/use-store";

type Props = {
  /** compact：顶栏两个大按钮；full：含 Token / Gist 设置 */
  variant?: "compact" | "full";
  onMessage?: (msg: string) => void;
};

export function GithubSyncControls({
  variant = "full",
  onMessage,
}: Props) {
  const { exportJson, importJson } = useStore();
  const [token, setToken] = useState("");
  const [gistId, setGistId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    const saved = loadGithubSyncSettings();
    setToken(saved.token);
    let gist = saved.gistId;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("gist");
      if (fromUrl?.trim()) {
        gist = fromUrl.trim();
        saveGithubGistId(gist);
      }
    } catch {
      // ignore
    }
    setGistId(gist);
    if (!saved.token) setSetupOpen(true);
  }, []);

  function flash(msg: string) {
    setMessage(msg);
    onMessage?.(msg);
    window.setTimeout(() => setMessage(null), 4000);
  }

  const ready = Boolean(token.trim());

  async function onPush() {
    if (!token.trim()) {
      setSetupOpen(true);
      flash("请先填写 GitHub Token");
      return;
    }
    setBusy(true);
    try {
      saveGithubToken(token);
      const json = exportJson();
      let taskCount = 0;
      try {
        const parsed = JSON.parse(json) as { tasks?: unknown[] };
        taskCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      } catch {
        // ignore
      }
      const result = await pushSnapshotToGist(json, { token, gistId });
      setGistId(result.gistId);
      saveGithubGistId(result.gistId);
      flash(
        result.created
          ? `已上传 ${taskCount} 条（新建 Gist：${result.gistId}）`
          : `已上传 ${taskCount} 条到 GitHub`,
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function onPull() {
    if (!token.trim() || !gistId.trim()) {
      setSetupOpen(true);
      flash("请先填写 Token，并填好 Gist ID（或先上传一次）");
      return;
    }
    if (
      !confirm(
        "从云端拉取会覆盖本机当前全部任务与总结。建议先导出备份。继续？",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      saveGithubToken(token);
      saveGithubGistId(gistId);
      const raw = await pullSnapshotFromGist({ token, gistId });
      importJson(raw);
      let taskCount = 0;
      try {
        const parsed = JSON.parse(raw) as { tasks?: unknown[] };
        taskCount = Array.isArray(parsed.tasks) ? parsed.tasks.length : 0;
      } catch {
        // ignore
      }
      flash(
        taskCount > 0
          ? `已拉取 ${taskCount} 条待办，请到「今日」或展开对应日期查看`
          : "已拉取，但云端 JSON 里待办是 0 条（电脑是否先点了「上传到云」？）",
      );
    } catch (err) {
      flash(err instanceof Error ? err.message : "拉取失败");
    } finally {
      setBusy(false);
    }
  }

  const buttons = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={busy}
        className="rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        onClick={() => void onPush()}
      >
        {busy ? "处理中…" : "上传到云"}
      </button>
      <button
        type="button"
        disabled={busy}
        className="dx-btn rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50"
        onClick={() => void onPull()}
      >
        从云拉取
      </button>
      {variant === "compact" ? (
        <button
          type="button"
          className="dx-btn rounded-lg px-2.5 py-2 text-[11px]"
          onClick={() => setSetupOpen((v) => !v)}
        >
          {setupOpen ? "收起设置" : ready ? "同步设置" : "先配置"}
        </button>
      ) : null}
    </div>
  );

  const setup = (
    <div className="space-y-2">
      <label className="block text-[11px] text-[var(--muted)]">
        GitHub Token（需 gist 权限）
        <div className="mt-1 flex gap-1.5">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onBlur={() => saveGithubToken(token)}
            placeholder="ghp_… 或 github_pat_…"
            className="dx-input min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-xs"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="dx-btn shrink-0 rounded-lg px-2 py-1.5 text-[11px]"
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? "隐藏" : "显示"}
          </button>
        </div>
      </label>
      <label className="block text-[11px] text-[var(--muted)]">
        Gist ID（首次上传可留空）
        <input
          value={gistId}
          onChange={(e) => setGistId(e.target.value)}
          onBlur={() => saveGithubGistId(gistId)}
          placeholder="首次上传后自动填入"
          className="dx-input mt-1 w-full rounded-lg px-2.5 py-1.5 text-xs"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {gistId ? (
        <p className="break-all text-[10px] text-[var(--muted)]">
          手机打开：当前网址加{" "}
          <code className="text-[var(--ink-soft)]">?gist={gistId}</code>
          <br />
          <a
            href={gistHtmlUrl(gistId)}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-ink)] underline-offset-2 hover:underline"
          >
            在 GitHub 查看 Gist
          </a>
        </p>
      ) : null}
      <p className="text-[10px] leading-relaxed text-[var(--muted)]">
        Token：GitHub → Settings → Developer settings → Personal access
        tokens，勾选 <code>gist</code>。只存在本机，勿发给别人。
      </p>
    </div>
  );

  if (variant === "compact") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[var(--ink)]">
            GitHub 同步
          </p>
          {gistId ? (
            <span className="truncate font-mono text-[10px] text-[var(--muted)]">
              {gistId.slice(0, 8)}…
            </span>
          ) : null}
        </div>
        {buttons}
        {setupOpen ? setup : null}
        {message ? (
          <p className="text-[11px] text-[var(--accent-ink)]">{message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {setup}
      {buttons}
      {message ? (
        <p className="text-[11px] text-[var(--accent-ink)]">{message}</p>
      ) : null}
    </div>
  );
}
