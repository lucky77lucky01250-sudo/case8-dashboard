import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeHeader,
  parseAmount,
  parseSalesCsvText,
} from "../lib/csv/parser";

const csv = readFileSync(new URL("./fixtures/invalid-rows.csv", import.meta.url), "utf8");
const parsed = parseSalesCsvText(csv);

describe("normalizeDate（D-3 #1）", () => {
  it("new Date() が Invalid Date として通してしまう値を弾く", () => {
    expect(normalizeDate("あいうえお")).toBeNull();
    // 参考: new Date("あいうえお") は Invalid Date という「Dateオブジェクト」を返す
    expect(new Date("あいうえお") instanceof Date).toBe(true);
  });

  it("暦として存在しない日付を弾く", () => {
    expect(normalizeDate("2025-02-30")).toBeNull();
    expect(normalizeDate("2025-13-01")).toBeNull();
    expect(normalizeDate("2025-02-29")).toBeNull();
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
  });

  it("スラッシュ表記とゼロ埋めなしを正規化する", () => {
    expect(normalizeDate("2025/09/10")).toBe("2025-09-10");
    expect(normalizeDate("2025/9/3")).toBe("2025-09-03");
  });
});

describe("parseAmount（D-3 #2, #3）", () => {
  it("空欄を 0 ではなく無効として返す", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
    // 参考: z.coerce.number() は Number("") === 0 のためこれを通してしまう
    expect(Number("")).toBe(0);
  });

  it("返品行のマイナス値を有効として通す", () => {
    expect(parseAmount("-4500")).toBe(-4500);
  });

  it("桁区切りと通貨記号を許容する", () => {
    expect(parseAmount("24,800")).toBe(24800);
    expect(parseAmount("¥24,800")).toBe(24800);
  });

  it("数値でない文字列を弾く", () => {
    expect(parseAmount("なし")).toBeNull();
    expect(parseAmount("1,2a0")).toBeNull();
  });
});

describe("normalizeHeader", () => {
  it("表記揺れを内部キーに寄せる", () => {
    expect(normalizeHeader("Order Date")).toBe("order_date");
    expect(normalizeHeader("Created at")).toBe("order_date");
    expect(normalizeHeader(" QTY ")).toBe("quantity");
    expect(normalizeHeader("注文日")).toBe("order_date");
  });
});

describe("無効行の検出", () => {
  it("空行を挟んでも実CSVの行番号がズレない（D-3 #4）", () => {
    // fixture の実際の行番号: 3=日付不正 / 4=存在しない日付 / 6=revenue空欄 / 10=customer_id空
    // 空行(5行目)を飛ばして採番すると 3,4,5,9 になり、クライアントが別の行を見ることになる
    expect(parsed.invalid.map((row) => row.line)).toEqual([3, 4, 6, 10]);
  });

  it("空欄の revenue を無効行として検出する", () => {
    const row = parsed.invalid.find((entry) => entry.line === 6)!;
    expect(row.reason).toContain("revenue");
  });

  it("空行そのものは無効行として報告しない", () => {
    expect(parsed.invalid.map((row) => row.line)).not.toContain(5);
  });
});

describe("有効行の扱い", () => {
  it("空行と無効行を除いた4件が有効", () => {
    expect(parsed.valid).toHaveLength(4);
  });

  it("category 欠損は捨てずに「未分類」へ寄せる（D-3 #6）", () => {
    const row = parsed.valid.find((entry) => entry.sku === "LUM-OUT-01")!;
    expect(row.category).toBe("未分類");
  });

  it("返品行を有効行として残す（D-3 #3）", () => {
    const row = parsed.valid.find((entry) => entry.sku === "LUM-ACC-01")!;
    expect(row).toMatchObject({ quantity: -1, revenue: -4500, cost: -1500 });
  });

  it("スラッシュ日付を正規化し、月はタイムゾーンに依存しない文字列で持つ", () => {
    const row = parsed.valid.find((entry) => entry.sku === "LUM-ACC-02")!;
    expect(row.orderDate).toBe("2025-09-10");
    expect(row.month).toBe("2025-09");
  });
});

describe("必須列の欠落", () => {
  it("列そのものが無い場合は集計に進ませない", () => {
    const result = parseSalesCsvText("order_date,customer_id\n2025-09-03,C001\n");
    expect(result.missingColumns).toContain("revenue");
    expect(result.valid).toEqual([]);
  });
});

// 提案書 第2項の約束「ドラッグ&ドロップ。列の並びが違っても自動判定」
describe("列の並び順と表記揺れ", () => {
  it("列の順序が入れ替わっていても正しく取り込む", () => {
    const shuffled = [
      "cost,revenue,quantity,sku,category,product_name,customer_id,order_date",
      "2800,7600,2,LUM-TOP-01,トップス,オーガニックコットンTシャツ,C001,2025-09-03",
    ].join("\n");

    const result = parseSalesCsvText(shuffled);

    expect(result.invalid).toEqual([]);
    expect(result.valid[0]).toEqual({
      orderDate: "2025-09-03",
      month: "2025-09",
      customerId: "C001",
      productName: "オーガニックコットンTシャツ",
      category: "トップス",
      sku: "LUM-TOP-01",
      quantity: 2,
      revenue: 7600,
      cost: 2800,
    });
  });

  it("Shopifyやexcel由来の列名の揺れを吸収する", () => {
    const varied = [
      "Order Date,Customer ID,Product Name,Category,SKU,QTY,Sales,原価",
      "2025/9/3,C001,オーガニックコットンTシャツ,トップス,LUM-TOP-01,2,\"7,600\",2800",
    ].join("\n");

    const result = parseSalesCsvText(varied);

    expect(result.missingColumns).toEqual([]);
    expect(result.invalid).toEqual([]);
    expect(result.valid[0]).toMatchObject({
      orderDate: "2025-09-03",
      customerId: "C001",
      quantity: 2,
      revenue: 7600,
    });
  });

  it("Excelが付けるBOMで1行目が壊れない", () => {
    const withBom =
      "﻿order_date,customer_id,product_name,category,sku,quantity,revenue,cost\n" +
      "2025-09-03,C001,Tシャツ,トップス,LUM-TOP-01,2,7600,2800\n";

    const result = parseSalesCsvText(withBom);

    expect(result.missingColumns).toEqual([]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].orderDate).toBe("2025-09-03");
  });
});
