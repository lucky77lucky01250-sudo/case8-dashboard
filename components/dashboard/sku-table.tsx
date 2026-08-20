import type { SalesSummary } from "@/lib/aggregate";
import { formatYen } from "@/lib/format";

type Props = { skuRanking: SalesSummary["skuRanking"] };

/** D-2: 売上ベースのトップ10。講義SQLの数量ベースは採用しない */
export function SkuTable({ skuRanking }: Props) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-brand-navy">SKU トップ10（売上ベース）</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-600">
            <tr>
              <th className="w-12 py-2 pr-3 font-medium">順位</th>
              <th className="py-2 pr-3 font-medium">商品名</th>
              <th className="hidden py-2 pr-3 font-medium sm:table-cell">SKU</th>
              <th className="py-2 pr-3 text-right font-medium">売上</th>
              <th className="hidden py-2 text-right font-medium sm:table-cell">数量</th>
            </tr>
          </thead>
          <tbody>
            {skuRanking.map((entry, index) => (
              <tr key={entry.sku} className="border-b border-zinc-100 last:border-0">
                <td className="py-2 pr-3 tabular-nums text-zinc-500">{index + 1}</td>
                <td className="py-2 pr-3 text-zinc-900">{entry.productName}</td>
                <td className="hidden py-2 pr-3 font-mono text-xs text-zinc-500 sm:table-cell">
                  {entry.sku}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium whitespace-nowrap text-brand-navy">
                  {formatYen(entry.revenue)}
                </td>
                <td className="hidden py-2 text-right tabular-nums text-zinc-700 sm:table-cell">
                  {entry.quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {skuRanking.length < 10 && (
        <p className="mt-3 text-xs text-zinc-500">
          データに含まれるSKUは {skuRanking.length} 種のため、{skuRanking.length} 件を表示しています。
        </p>
      )}
    </div>
  );
}
