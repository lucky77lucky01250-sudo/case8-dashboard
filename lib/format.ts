/** 通貨表示。円は整数で扱うため小数は出さない */
export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** 売上・粗利の前月比（変化率）。前月がなければ「—」 */
export function formatChangePercent(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** リピート率の前月比（ポイント差）。率の変化率は発散するためポイントで出す */
export function formatChangePoint(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}pt`;
}

/** 2025-09 → 2025年9月 */
export function formatMonth(month: string): string {
  const [year, monthPart] = month.split("-");
  return `${year}年${Number(monthPart)}月`;
}

/** 2025-09 → 9月（グラフの軸用） */
export function formatMonthShort(month: string): string {
  return `${Number(month.split("-")[1])}月`;
}
