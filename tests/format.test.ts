import { describe, expect, it } from "vitest";
import { formatDateTime } from "../lib/format";

/**
 * 本番で実際に起きた不具合の回帰テスト。
 *
 * `toLocaleString("ja-JP")` はロケール（書式）だけを指定するもので、
 * タイムゾーンは実行環境のものが使われる。そのため
 * サーバ描画（Vercel = UTC）とクライアント描画（日本のブラウザ = JST）で
 * 同じ時刻が9時間ずれて表示されていた。
 *
 * ローカルの `next dev` はサーバもブラウザも JST のため再現しない。
 * CI は UTC で動くので、タイムゾーン指定を外すとここで落ちる。
 */
describe("formatDateTime", () => {
  const instant = "2026-08-22T13:59:16Z";

  it("実行環境のタイムゾーンによらず日本時間で表示する", () => {
    expect(formatDateTime(instant)).toBe("2026/8/22 22:59:16");
  });

  it("Date・文字列・数値のどれを渡しても同じ結果になる", () => {
    const asDate = new Date(instant);
    expect(formatDateTime(asDate)).toBe(formatDateTime(instant));
    expect(formatDateTime(asDate.getTime())).toBe(formatDateTime(instant));
  });

  it("日付をまたぐ時刻でも日本時間の日付になる", () => {
    // UTC では 8/22、JST では 8/23
    expect(formatDateTime("2026-08-22T15:30:00Z")).toBe("2026/8/23 0:30:00");
  });
});
