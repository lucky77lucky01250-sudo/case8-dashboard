import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 実際の Supabase に接続する結合テストは既定の実行から外す。
    // CI にはシークレットを置かないため（pnpm test:integration で個別に実行する）
    exclude: ["node_modules/**", "tests/integration/**"],
  },
});
