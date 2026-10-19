import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "out");
if (!existsSync(outDir)) {
  console.error(
    "[Dotline] 构建后未找到 out/ 目录。请确认 next.config.mjs 含有 output: \"export\"。",
  );
  process.exit(1);
}

const files = readdirSync(outDir);
console.log(`[Dotline] out/ 已生成，共 ${files.length} 项:`, files.slice(0, 12).join(", "));
