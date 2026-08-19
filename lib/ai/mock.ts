import type { SalesSummary } from "../aggregate";
import { formatMonth, formatPercent, formatYen } from "../format";
import type { Analysis } from "./schema";

/**
 * APIキーが届く前に画面と検収の流れを確認するための仮コメント。
 * 集計値だけから機械的に組み立てるので、実データと矛盾しない
 */
export function buildMockAnalysis(summary: SalesSummary): Analysis {
  const latest = summary.months[summary.months.length - 1];
  const topCategory = summary.categories[0];
  const topSku = summary.skuRanking[0];
  const monthLabel = formatMonth(latest.month);

  return {
    summary:
      `${monthLabel}の売上は${formatYen(latest.revenue)}、粗利は${formatYen(latest.grossProfit)}でした。` +
      (latest.revenueChangePercent === null
        ? "比較対象となる前月のデータがないため、前月比は算出していません。"
        : `売上は前月比 ${latest.revenueChangePercent > 0 ? "+" : ""}${latest.revenueChangePercent.toFixed(1)}% です。`) +
      `カテゴリ別では${topCategory.category}が${formatYen(topCategory.revenue)}で最大の構成比を占めています。`,
    highlights: [
      `${monthLabel}のリピート率（月次）は ${formatPercent(latest.repeatRate)}（購入 ${latest.customerCount} 名中 ${latest.repeatCustomerCount} 名）です。`,
      `期間累計のリピート率は ${formatPercent(summary.overall.repeatRate)}（${summary.overall.customerCount} 名中 ${summary.overall.repeatCustomerCount} 名）です。`,
      `売上ベースのSKU1位は${topSku.productName}で ${formatYen(topSku.revenue)} です。`,
    ],
    actions: [
      {
        title: `${topCategory.category}カテゴリの在庫と露出を翌月も維持する`,
        rationale: `${topCategory.category}が期間売上の最大構成比（${formatYen(topCategory.revenue)}）を占めているため。`,
        metric: `翌月の${topCategory.category}カテゴリ売上`,
      },
      {
        title: `${topSku.productName}の在庫切れを起こさない発注計画を立てる`,
        rationale: `売上ベースで1位（${formatYen(topSku.revenue)}／${topSku.quantity}点）のため、欠品の機会損失が大きい。`,
        metric: `${topSku.productName}の翌月販売数量`,
      },
      {
        title: "前月購入者への再購入クーポンを配信する",
        rationale: `月次リピート率が ${formatPercent(latest.repeatRate)} にとどまっているため。`,
        metric: "翌月のリピート率（月次）",
      },
    ],
  };
}
