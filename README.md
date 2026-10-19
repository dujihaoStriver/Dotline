# 点线 · 时间点备忘与周期复盘

个人自用 Web MVP：按起止日期记录任务，在「月 → 周 → 日」脉络里展开查看，并一键生成周 / 月 / 年总结底稿。

## 快速开始

```bash
cd web
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 信息架构

| 页面 | 路径 | 作用 |
|------|------|------|
| 脉络 | `/` | 横向一年图：快记、跨日框、点年/月/周写复盘 |
| 今日 | `/today` | 当天扁平列表，适合手机快记 |
| 本周 / 本月 / 本年 | `/week` `/month` `/year` | 直达复盘页（不再占底栏） |

## 数据模型

- `tasks`：`startDate` / `endDate`、独立 `color`；可选具体时刻（`timed`）
- `reviews`：`week` / `month` / `year`，按 `periodKey` 唯一

当前持久化：**浏览器 localStorage**（键名 `dianxian.v1`）。  
云同步 schema 见 `supabase/schema.sql`，跑通习惯后再接 Supabase。

## 复盘规则

- **周**：周一为一周起始；拉取本周任务生成 Markdown 底稿
- **月**：本月全部任务 + 与本月日期重叠的周总结心得/结转（不是硬拼 4 篇）
- **年**：全年任务月度概况 + 各月总结心得

底栏：**脉络 | 今日**。备份入口在脉络侧栏底部。

## 下一步（可选）

1. 接 Supabase Auth + 上述表结构  
2. 导出 `.ics` / Bark 提醒  
3. PWA「添加到主屏幕」
