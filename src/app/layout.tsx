import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "点线",
    template: "%s · 点线",
  },
  description: "记录时间点任务，一键生成周 / 月 / 年总结底稿",
  applicationName: "点线",
  icons: {
    icon: [
      { url: "/favicon.png?v=5", sizes: "32x32", type: "image/png" },
      { url: "/icon-512.png?v=5", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png?v=5",
    apple: [{ url: "/apple-touch-icon.png?v=5", sizes: "180x180", type: "image/png" }],
  },
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
