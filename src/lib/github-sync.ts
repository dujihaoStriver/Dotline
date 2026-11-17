/** GitHub Gist 同步：Token 与 Gist ID 只存在本机浏览器，不写进网站源码。 */

const TOKEN_KEY = "dianxian.github.token";
const GIST_KEY = "dianxian.github.gistId";
const FILE_NAME = "dianxian.json";

export type GithubSyncSettings = {
  token: string;
  gistId: string;
};

export function loadGithubSyncSettings(): GithubSyncSettings {
  if (typeof window === "undefined") return { token: "", gistId: "" };
  return {
    token: window.localStorage.getItem(TOKEN_KEY) ?? "",
    gistId: window.localStorage.getItem(GIST_KEY) ?? "",
  };
}

export function saveGithubToken(token: string): void {
  if (typeof window === "undefined") return;
  const t = token.trim();
  if (t) window.localStorage.setItem(TOKEN_KEY, t);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function saveGithubGistId(gistId: string): void {
  if (typeof window === "undefined") return;
  const id = gistId.trim();
  if (id) window.localStorage.setItem(GIST_KEY, id);
  else window.localStorage.removeItem(GIST_KEY);
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

async function readGithubError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return `GitHub 请求失败（${res.status}）`;
}

/** 上传：有 gistId 则更新，否则新建私有 Gist 并返回 id */
export async function pushSnapshotToGist(
  json: string,
  settings: GithubSyncSettings,
): Promise<{ gistId: string; created: boolean }> {
  const token = settings.token.trim();
  if (!token) throw new Error("请先填写 GitHub Token");

  const gistId = settings.gistId.trim();
  if (gistId) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        files: {
          [FILE_NAME]: { content: json },
        },
      }),
    });
    if (!res.ok) throw new Error(await readGithubError(res));
    return { gistId, created: false };
  }

  const res = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      description: "点线 · dianxian sync",
      public: false,
      files: {
        [FILE_NAME]: { content: json },
      },
    }),
  });
  if (!res.ok) throw new Error(await readGithubError(res));
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("创建 Gist 成功但未返回 ID");
  return { gistId: data.id, created: true };
}

/** 从 Gist 拉取 dianxian.json 文本 */
export async function pullSnapshotFromGist(
  settings: GithubSyncSettings,
): Promise<string> {
  const token = settings.token.trim();
  const gistId = settings.gistId.trim();
  if (!token) throw new Error("请先填写 GitHub Token");
  if (!gistId) throw new Error("请先填写 Gist ID（或先上传一次自动生成）");

  const res = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await readGithubError(res));
  const data = (await res.json()) as {
    files?: Record<string, { content?: string; truncated?: boolean; raw_url?: string }>;
  };
  const file =
    data.files?.[FILE_NAME] ??
    Object.values(data.files ?? {}).find((f) => f.content || f.raw_url);
  if (!file) throw new Error(`Gist 中找不到 ${FILE_NAME}`);

  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!rawRes.ok) throw new Error("拉取完整 JSON 失败（文件过大）");
    return rawRes.text();
  }
  if (!file.content) throw new Error("Gist 文件内容为空");
  return file.content;
}

export function gistHtmlUrl(gistId: string): string {
  return `https://gist.github.com/${gistId}`;
}
