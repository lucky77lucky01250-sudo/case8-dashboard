import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aggregateSales } from "../../lib/aggregate";
import type { SaleRow } from "../../lib/csv/types";

/**
 * 実際の Supabase に対する結合テスト。`pnpm test:integration` で実行する。
 *
 * 提案書 第9項(1) は「サンプル40件だけでなく、本番と同じ件数のデータでも
 * 一致することを確認します」と約束している。その確認をここで自動化する。
 *
 * 最大の関心事は PostgREST の1,000行上限。素直に select すると
 * エラーも警告もなく1,000行で打ち切られ、合計金額が実際より小さくなる
 */

// .env.local を読む（Next.js の外で動くため自前で読み込む）
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) {
    const i = t.indexOf("=");
    process.env[t.slice(0, i)] ??= t.slice(i + 1).trim();
  }
}

const { saveUpload, loadLatestUpload, saveReport, loadLatestReport } = await import(
  "../../lib/supabase/sales"
);

const ROW_COUNT = 2500;
const FILE_NAME = `__integration_test__${Date.now()}.csv`;

/** 合計が計算で分かる合成データ。1,000行の壁をまたぐ件数にする */
function buildRows(count: number): SaleRow[] {
  const categories = ["アウター", "トップス", "ボトムス", "アクセサリー"];
  return Array.from({ length: count }, (_, i) => ({
    orderDate: `2025-${String((i % 3) + 9).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
    month: `2025-${String((i % 3) + 9).padStart(2, "0")}`,
    customerId: `C${String(i % 400).padStart(4, "0")}`,
    productName: `商品${i % 12}`,
    category: categories[i % categories.length],
    sku: `LUM-TEST-${String(i % 12).padStart(2, "0")}`,
    quantity: 1,
    revenue: 1000 + (i % 10),
    cost: 400,
  }));
}

const rows = buildRows(ROW_COUNT);
let uploadId: string | null = null;

beforeAll(async () => {
  const result = await saveUpload({ fileName: FILE_NAME, rows, invalid: [] });
  if ("error" in result) throw new Error(`保存に失敗: ${result.error}`);
  uploadId = result.uploadId;
});

afterAll(async () => {
  if (!uploadId) return;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  // sales_data は cascade で消える
  await admin.from("uploads").delete().eq("id", uploadId);
});

describe(`${ROW_COUNT}行の保存と読み出し`, () => {
  it("保存した行数がそのまま返る（1,000行で打ち切られない）", async () => {
    const loaded = await loadLatestUpload();

    expect(loaded).not.toHaveProperty("error");
    expect(loaded).not.toHaveProperty("empty");
    if ("error" in loaded || "empty" in loaded) return;

    expect(loaded.upload.fileName).toBe(FILE_NAME);
    expect(loaded.rows).toHaveLength(ROW_COUNT);
  });

  it("読み出した行から計算した集計が、保存前の集計と完全に一致する", async () => {
    const loaded = await loadLatestUpload();
    if ("error" in loaded || "empty" in loaded) throw new Error("読み出しに失敗");

    const before = aggregateSales(rows);
    const after = aggregateSales(loaded.rows);

    expect(after.overall).toEqual(before.overall);
    expect(after.months).toEqual(before.months);
    expect(after.categories).toEqual(before.categories);
    expect(after.skuRanking).toEqual(before.skuRanking);
  });

  it("金額の合計がDB往復で1円も変わらない", async () => {
    const loaded = await loadLatestUpload();
    if ("error" in loaded || "empty" in loaded) throw new Error("読み出しに失敗");

    const expectedRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
    const actualRevenue = loaded.rows.reduce((sum, r) => sum + r.revenue, 0);

    expect(actualRevenue).toBe(expectedRevenue);
    expect(aggregateSales(loaded.rows).overall.revenue).toBe(expectedRevenue);
  });
});

describe("AI分析コメントの保存と読み出し", () => {
  it("保存したコメントがそのまま復元される", async () => {
    if (!uploadId) throw new Error("uploadId がありません");

    const analysis = {
      summary: "11月の売上は前月比+79.5%でした。",
      highlights: ["アウターが287,400円で最大", "リピート率は46.7%"],
      actions: [
        { title: "アウターの在庫を確保する", rationale: "売上の51.3%を占めるため", metric: "12月のアウター売上" },
      ],
    };

    const saved = await saveReport({
      uploadId,
      model: "claude-opus-5",
      summary: analysis.summary,
      highlights: analysis.highlights,
      actions: analysis.actions,
    });
    expect(saved.error).toBeUndefined();

    const loaded = await loadLatestReport(uploadId);

    expect(loaded).not.toBeNull();
    expect(loaded!.model).toBe("claude-opus-5");
    expect(loaded!.summary).toBe(analysis.summary);
    expect(loaded!.highlights).toEqual(analysis.highlights);
    // jsonb を往復してもアクション提案の構造が崩れないこと
    expect(loaded!.actions).toEqual(analysis.actions);
  });

  it("コメントが無いアップロードでは null が返る", async () => {
    const result = await saveUpload({
      fileName: `__integration_no_report__${Date.now()}.csv`,
      rows: rows.slice(0, 5),
      invalid: [],
    });
    if ("error" in result) throw new Error(result.error);

    await expect(loadLatestReport(result.uploadId)).resolves.toBeNull();

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await admin.from("uploads").delete().eq("id", result.uploadId);
  });
});
