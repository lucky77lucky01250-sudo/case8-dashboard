import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // server-only は「サーバー以外から読み込まれた」と判断すると例外を投げる。
      // テストランナーはその判定に引っかかるため、空モジュールに差し替える
      "server-only": fileURLToPath(new URL("./tests/integration/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    // 実DBへ数千行を書き込むため、既定のタイムアウトでは足りない
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
