import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aggregateSales } from "../lib/aggregate";
import { parseSalesCsvText } from "../lib/csv/parser";
import { buildMockAnalysis } from "../lib/ai/mock";
import { buildAnalysisInput, buildUserMessage } from "../lib/ai/prompt";
import { AnalysisSchema, analysisJsonSchema } from "../lib/ai/schema";

const csv = readFileSync(new URL("./fixtures/sample-sales.csv", import.meta.url), "utf8");
const parsed = parseSalesCsvText(csv);
const summary = aggregateSales(parsed.valid);
const input = buildAnalysisInput(summary);

// 講義の「Snapshot テスト」。AI の応答は非決定的なので、固定するのは
// AI に渡す入力（集計結果）の側にする（D-3 #10）
describe("AIに渡す入力のSnapshot", () => {
  it("集計結果からプロンプト入力が決まる", () => {
    expect(input).toMatchSnapshot();
  });

  it("ユーザーメッセージも固定される", () => {
    expect(buildUserMessage(input)).toMatchSnapshot();
  });
});

// 提案書 第8項「個々のお客様のIDや氏名は送信いたしません」
describe("外部送信するデータに顧客情報が含まれないこと", () => {
  const serialized = JSON.stringify(input);

  it("顧客IDが1件も含まれない", () => {
    const customerIds = [...new Set(parsed.valid.map((row) => row.customerId))];
    expect(customerIds.length).toBeGreaterThan(0);
    for (const customerId of customerIds) {
      expect(serialized).not.toContain(customerId);
    }
  });

  it("注文日（明細レベルの情報）が含まれない", () => {
    for (const row of parsed.valid) {
      expect(serialized).not.toContain(row.orderDate);
    }
  });

  it("送るのは集計後の数値だけ", () => {
    expect(Object.keys(input).sort()).toEqual([
      "categories",
      "monthly",
      "overall",
      "period",
      "skuRankingByRevenue",
    ]);
  });
});

describe("構造化出力のJSON Schema", () => {
  const schema = analysisJsonSchema();

  it("Messages APIが受け付けない $schema キーを含まない", () => {
    expect(schema).not.toHaveProperty("$schema");
  });

  it("additionalProperties: false と required を持つ", () => {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(["summary", "highlights", "actions"]);
  });
});

describe("APIキー未設定時の仮コメント", () => {
  const mock = buildMockAnalysis(summary);

  it("本番と同じスキーマを満たす", () => {
    expect(AnalysisSchema.safeParse(mock).success).toBe(true);
  });

  it("集計値と矛盾しない数字を含む", () => {
    expect(mock.summary).toContain("¥264,700");
    expect(mock.actions.length).toBeGreaterThanOrEqual(3);
  });
});
