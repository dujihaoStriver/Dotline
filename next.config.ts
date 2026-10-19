import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 帽子云等静态托管
  output: "export",
  images: { unoptimized: true },
  // 本地 / 构建时正确处理 Tailwind v4
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
