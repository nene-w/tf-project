import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // 排除需要真实数据库/网络连接的集成测试（在 CI 中单独运行）
    exclude: ["server/fundamentalData.integration.test.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
