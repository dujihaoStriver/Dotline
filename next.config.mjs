/** @type {import('next').NextConfig} */
const nextConfig = {
  // 必须：帽子云静态托管只认 out 目录
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
