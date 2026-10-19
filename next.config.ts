import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 帽子云 / Cloudflare Pages 等静态托管需要
  output: "export",
  images: { unoptimized: true },
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
