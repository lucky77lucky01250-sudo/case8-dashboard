import { describe, expect, it } from "vitest";
import iconv from "iconv-lite";
import { parseSalesCsvText } from "../lib/csv/parser";

/**
 * Shift_JIS で保存されたCSVの扱い。
 *
 * Excel の「CSV(カンマ区切り)」は既定が Shift_JIS。担当者が普通に保存すると
 * これになる。File.text() は UTF-8 でデコードするため、不正なバイトは
 * U+FFFD に置き換わる。日付・数量・金額は ASCII なので素通りし、
 * 商品名とカテゴリだけが文字化けしたまま集計されていた（D-21）。
 */

const HEADER = "order_date,customer_id,product_name,category,sku,quantity,revenue,cost";
const ROW = "2025-09-01,C001,オーガニックコットンTシャツ,トップス,SKU-TS-001,1,3800,1400";

/** Shift_JIS で保存されたCSVを File.text() が読んだ状態を再現する */
function readAsUtf8(csv: string): string {
  return new TextDecoder("utf-8").decode(iconv.encode(csv, "Shift_JIS"));
}

describe("Shift_JIS のCSV", () => {
  it("日本語ヘッダーの場合は必須列が見つからず、取り込み自体が止まる", () => {
    const csv = "注文日,顧客id,商品名,商品コード,数量,売上,原価\n2025-09-01,C001,Tシャツ,SKU1,1,3800,1400\n";
    const result = parseSalesCsvText(readAsUtf8(csv));

    expect(result.missingColumns.length).toBeGreaterThan(0);
    expect(result.valid).toHaveLength(0);
  });

  it("英語ヘッダー + 日本語データの場合は、文字化けを検出して無効行にする", () => {
    const result = parseSalesCsvText(readAsUtf8(`${HEADER}\n${ROW}\n`));

    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].line).toBe(2);
    expect(result.invalid[0].reason).toContain("UTF-8");
  });

  it("文字化けを金額の異常と誤って報告しない", () => {
    const result = parseSalesCsvText(readAsUtf8(`${HEADER}\n${ROW}\n`));

    expect(result.invalid[0].reason).not.toContain("revenue");
    expect(result.invalid[0].reason).not.toContain("quantity");
  });

  it("UTF-8 で保存されていれば従来どおり取り込める", () => {
    const result = parseSalesCsvText(`${HEADER}\n${ROW}\n`);

    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].productName).toBe("オーガニックコットンTシャツ");
    expect(result.valid[0].category).toBe("トップス");
  });

  it("BOM付きUTF-8（Excel の CSV UTF-8）も取り込める", () => {
    const result = parseSalesCsvText(`﻿${HEADER}\n${ROW}\n`);

    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].productName).toBe("オーガニックコットンTシャツ");
  });
});
