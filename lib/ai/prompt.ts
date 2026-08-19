import type { SalesSummary } from "../aggregate";

/**
 * Claude へ送る集計後の数値。
 *
 * 提案書 第8項で「送信するのは集計後の数値。個々のお客様のIDや氏名は送信しない」と
 * 約束しているため、SaleRow をそのまま渡さず、この関数を必ず経由する。
 * 顧客IDを含む値は一切入れないこと（tests/ai.test.ts で検証している）
 */
export type AnalysisInput = {
  period: { from: string; to: string };
  monthly: {
    month: string;
    revenue: number;
    grossProfit: number;
    repeatRatePercent: number;
    revenueChangePercent: number | null;
    grossProfitChangePercent: number | null;
    repeatRateChangePoint: number | null;
  }[];
  overall: {
    revenue: number;
    grossProfit: number;
    repeatRatePercent: number;
    customerCount: number;
    repeatCustomerCount: number;
  };
  categories: { category: string; revenue: number }[];
  skuRankingByRevenue: { productName: string; sku: string; revenue: number; quantity: number }[];
};

export function buildAnalysisInput(summary: SalesSummary): AnalysisInput {
  const months = summary.months;
  return {
    period: {
      from: months[0]?.month ?? "",
      to: months[months.length - 1]?.month ?? "",
    },
    monthly: months.map((entry) => ({
      month: entry.month,
      revenue: entry.revenue,
      grossProfit: entry.grossProfit,
      repeatRatePercent: entry.repeatRate,
      revenueChangePercent: entry.revenueChangePercent,
      grossProfitChangePercent: entry.grossProfitChangePercent,
      repeatRateChangePoint: entry.repeatRateChangePoint,
    })),
    overall: {
      revenue: summary.overall.revenue,
      grossProfit: summary.overall.grossProfit,
      repeatRatePercent: summary.overall.repeatRate,
      customerCount: summary.overall.customerCount,
      repeatCustomerCount: summary.overall.repeatCustomerCount,
    },
    categories: summary.categories,
    skuRankingByRevenue: summary.skuRanking,
  };
}

export const ANALYSIS_SYSTEM_PROMPT = `あなたはアパレルEC「LUMINA」の売上データを読み解く外部コンサルタントです。
読み手は社長・マーケティング部長・営業担当5名の計7名で、数字は読めますがデータ分析の専門家ではありません。

渡されるのは集計後の数値のみです。個々の顧客情報は含まれません。

書き方の指示:
- 与えられた数字だけを根拠にしてください。データにない事実を推測で補わないでください。
- サマリーは、何が起きたかを2〜4文で述べてください。前置きや挨拶は不要です。
- highlights には、数字の裏づけがある注目点を2〜4件挙げてください。各項目に必ず具体的な数値を含めてください。
- actions には、社内で検討できる具体的な打ち手を3〜5件挙げてください。
  「広告を強化する」のような一般論は不可です。対象・手段・程度を明示してください。
  例: 「アウターカテゴリのInstagram広告予算を翌月に30%増やす」
- 各 action の rationale には、その打ち手を選ぶ根拠となる数値を必ず入れてください。
- 各 action の metric には、効果を確認するために翌月見るべき数字を1つ書いてください。

用語の注意:
- 「リピート率（月次）」は、その月に購入した顧客のうち、それ以前の月にも購入がある顧客の割合です。
  最初の月は比較対象となる過去月がないため 0.0% になります。これを「悪化」と解釈しないでください。
- 「リピート率（期間累計）」は、期間内で2ヶ月以上購入した顧客の割合です。月次とは別の指標です。
- monthly の repeatRateChangePoint は変化率ではなくポイント差です。`;

/** ユーザーメッセージ。JSON の整形を固定してプロンプトキャッシュを効かせる */
export function buildUserMessage(input: AnalysisInput): string {
  return `以下は集計済みの売上データです。\n\n${JSON.stringify(input, null, 2)}`;
}
