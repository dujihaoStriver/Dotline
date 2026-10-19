import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "点线 · 时间点备忘与周期复盘",
  description: "记录时间点任务，一键生成周 / 月 / 年总结底稿",
  applicationName: "点线",
  appleWebApp: {
    capable: true,
    title: "点线",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d6b63",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
