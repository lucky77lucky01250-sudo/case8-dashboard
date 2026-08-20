/**
 * Claude API の利用コストを実測するための計算。
 *
 * 提案書では Claude API を月500円で計上している（講義版の月1,000〜2,000円は
 * 算数が合わないため下げた数字）。その根拠を推測ではなく実測で持つために、
 * 呼び出しごとの usage を記録する。
 */

/** claude-opus-5 の単価（USD / 100万トークン） */
const PRICE_PER_MTOK = {
  input: 5,
  output: 25,
  /** キャッシュ書き込みは入力の1.25倍 */
  cacheWrite: 6.25,
  /** キャッシュ読み出しは入力の0.1倍 */
  cacheRead: 0.5,
} as const;

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

export type CostEstimate = TokenUsage & {
  usd: number;
  /** 参考値。為替は変動するため概算 */
  jpy: number;
};

const USD_TO_JPY = 155;

export function estimateCost(usage: TokenUsage): CostEstimate {
  const usd =
    (usage.inputTokens * PRICE_PER_MTOK.input +
      usage.outputTokens * PRICE_PER_MTOK.output +
      usage.cacheCreationInputTokens * PRICE_PER_MTOK.cacheWrite +
      usage.cacheReadInputTokens * PRICE_PER_MTOK.cacheRead) /
    1_000_000;

  return { ...usage, usd, jpy: usd * USD_TO_JPY };
}

export function formatCostLog(model: string, cost: CostEstimate): string {
  return [
    `[AI分析] model=${model}`,
    `input=${cost.inputTokens}`,
    `output=${cost.outputTokens}`,
    `cacheWrite=${cost.cacheCreationInputTokens}`,
    `cacheRead=${cost.cacheReadInputTokens}`,
    `cost=$${cost.usd.toFixed(4)} (約${cost.jpy.toFixed(1)}円)`,
  ].join(" ");
}
