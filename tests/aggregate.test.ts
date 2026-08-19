import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateSales } from "../lib/aggregate";
import { parseSalesCsvText } from "../lib/csv/parser";

const csv = readFileSync(new URL("./fixtures/sample-sales.csv", import.meta.url), "utf8");
const parsed = parseSalesCsvText(csv);
const summary = aggregateSales(parsed.valid);

const month = (value: string) => summary.months.find((entry) => entry.month === value)!;

describe("サンプルCSVのパース", () => {
  it("40件すべてが有効行として取り込まれる", () => {
    expect(parsed.missingColumns).toEqual([]);
    expect(parsed.invalid).toEqual([]);
    expect(parsed.valid).toHaveLength(40);
  });
});

// 以下の期待値は sample-data/README-sample.md の「正解値」をそのまま写したもの。
// 実装に合わせて書き換えてはいけない（提案書 第9項(1)「数値が一致すること」）
describe("READMEの正解値との一致", () => {
  it("月次の売上", () => {
    expect(month("2025-09").revenue).toBe(148400);
    expect(month("2025-10").revenue).toBe(147500);
    expect(month("2025-11").revenue).toBe(264700);
  });

  it("月次の粗利", () => {
    expect(month("2025-09").grossProfit).toBe(93400);
    expect(month("2025-10").grossProfit).toBe(92600);
    expect(month("2025-11").grossProfit).toBe(163100);
  });

  it("期間合計", () => {
    expect(summary.overall.revenue).toBe(560600);
    expect(summary.overall.grossProfit).toBe(349100);
  });

  it("カテゴリ別売上", () => {
    expect(summary.categories).toEqual([
      { category: "アウター", revenue: 287400 },
      { category: "トップス", revenue: 114400 },
      { category: "ボトムス", revenue: 82200 },
      { category: "アクセサリー", revenue: 76600 },
    ]);
  });

  it("期間累計リピート率（28人中8人 = 28.6%）", () => {
    expect(summary.overall.customerCount).toBe(28);
    expect(summary.overall.repeatCustomerCount).toBe(8);
    expect(summary.overall.repeatRate).toBe(28.6);
  });

  it("カテゴリ別の合計が売上合計と一致する", () => {
    const total = summary.categories.reduce((sum, entry) => sum + entry.revenue, 0);
    expect(total).toBe(summary.overall.revenue);
  });
});

describe("月次リピート率（D-1）", () => {
  it("最初の月は比較対象の過去月がないため0.0%", () => {
    expect(month("2025-09").repeatRate).toBe(0);
    expect(month("2025-09").repeatRateChangePoint).toBeNull();
  });

  it("2ヶ月目以降は既存顧客の割合", () => {
    expect(month("2025-10")).toMatchObject({
      customerCount: 13,
      repeatCustomerCount: 5,
      repeatRate: 38.5,
    });
    expect(month("2025-11")).toMatchObject({
      customerCount: 15,
      repeatCustomerCount: 7,
      repeatRate: 46.7,
    });
  });

  it("リピート率の前月比はポイント差で出す", () => {
    expect(month("2025-11").repeatRateChangePoint).toBe(8.2);
  });
});

describe("前月比", () => {
  it("最初の月は前月比を持たない", () => {
    expect(month("2025-09").revenueChangePercent).toBeNull();
    expect(month("2025-09").grossProfitChangePercent).toBeNull();
  });

  it("11月は売上が約1.8倍（READMEの読みどころ）", () => {
    expect(month("2025-11").revenueChangePercent).toBe(79.5);
    expect(month("2025-10").revenueChangePercent).toBe(-0.6);
  });
});

describe("SKUランキング（D-2: 売上ベース）", () => {
  it("ウールコートとダウンジャケットが上位に来る", () => {
    expect(summary.skuRanking.slice(0, 2)).toEqual([
      { productName: "ウールコート", sku: "LUM-OUT-01", revenue: 148800, quantity: 6 },
      { productName: "ダウンジャケット", sku: "LUM-OUT-02", revenue: 138600, quantity: 7 },
    ]);
  });

  it("サンプルのSKUは8種なのでトップ10は8件になる", () => {
    expect(summary.skuRanking).toHaveLength(8);
  });
});
