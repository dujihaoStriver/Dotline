export type ChangelogEntry = {
  /** 版本标识，用户看过此版后不再自动弹出 */
  version: string;
  /** 发布日期 YYYY-MM-DD */
  date: string;
  items: string[];
};

/** 最新在最前；发版时在顶部加一条，并更新 version */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.10.22",
    date: "2026-10-22",
    items: [
      "未完成的单日待办会自动结转到今天，前一天会灰显「已结转」留底，今天的统一用琥珀色、圈内标「遗留」",
      "已完成的待办会自动沉到列表后面",
      "连续添加待办时，颜色会自动轮换，不用手动换色",
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0];

export const WHATS_NEW_SEEN_KEY = "dianxian.whatsnew.seen";

/** 未关闭时最多自动展示几天 */
export const WHATS_NEW_SHOW_DAYS = 7;

export function isWithinShowWindow(entryDate: string, now = new Date()): boolean {
  const [y, m, d] = entryDate.split("-").map(Number);
  if (!y || !m || !d) return true;
  const start = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((today - start) / 86_400_000);
  return diffDays >= 0 && diffDays <= WHATS_NEW_SHOW_DAYS;
}
