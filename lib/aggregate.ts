import type { SaleRow } from "./csv/types";

export type MonthlyKpi = {
  month: string;
  revenue: number;
  grossProfit: number;
  /** その月に購入した顧客のうち、それ以前の月にも購入がある顧客の割合（D-1） */
  repeatRate: number;
  customerCount: number;
  repeatCustomerCount: number;
  /** 前月比。売上・粗利は変化率(%)、リピート率はポイント差。前月がなければ null */
  revenueChangePercent: number | null;
  grossProfitChangePercent: number | null;
  repeatRateChangePoint: number | null;
};

export type SalesSummary = {
  months: MonthlyKpi[];
  /** 期間全体。README の正解値と突き合わせる対象（D-1） */
  overall: {
    revenue: number;
    grossProfit: number;
    /** 期間内で2ヶ月以上購入した顧客の割合 */
    repeatRate: number;
    customerCount: number;
    repeatCustomerCount: number;
  };
  categories: { category: string; revenue: number }[];
  /** 売上ベースのトップ10（D-2。講義SQLの数量ベースは採用しない） */
  skuRanking: { productName: string; sku: string; revenue: number; quantity: number }[];
};

const round1 = (value: number) => Math.round(value * 10) / 10;

function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

export function aggregateSales(rows: SaleRow[]): SalesSummary {
  const monthsSeen = [...new Set(rows.map((row) => row.month))].sort();

  const customersByMonth = new Map<string, Set<string>>();
  const monthsByCustomer = new Map<string, Set<string>>();
  const revenueByMonth = new Map<string, number>();
  const costByMonth = new Map<string, number>();
  const revenueByCategory = new Map<string, number>();
  const skuTotals = new Map<
    string,
    { productName: string; sku: string; revenue: number; quantity: number }
  >();

  for (const row of rows) {
    revenueByMonth.set(row.month, (revenueByMonth.get(row.month) ?? 0) + row.revenue);
    costByMonth.set(row.month, (costByMonth.get(row.month) ?? 0) + row.cost);
    revenueByCategory.set(row.category, (revenueByCategory.get(row.category) ?? 0) + row.revenue);

    if (!customersByMonth.has(row.month)) customersByMonth.set(row.month, new Set());
    customersByMonth.get(row.month)!.add(row.customerId);

    if (!monthsByCustomer.has(row.customerId)) monthsByCustomer.set(row.customerId, new Set());
    monthsByCustomer.get(row.customerId)!.add(row.month);

    const key = `${row.sku} ${row.productName}`;
    const entry = skuTotals.get(key) ?? {
      productName: row.productName,
      sku: row.sku,
      revenue: 0,
      quantity: 0,
    };
    entry.revenue += row.revenue;
    entry.quantity += row.quantity;
    skuTotals.set(key, entry);
  }

  const months: MonthlyKpi[] = monthsSeen.map((month, index) => {
    const priorMonths = monthsSeen.slice(0, index);
    const customers = customersByMonth.get(month) ?? new Set<string>();
    const repeatCustomerCount = [...customers].filter((customerId) =>
      priorMonths.some((prior) => customersByMonth.get(prior)?.has(customerId)),
    ).length;

    const revenue = revenueByMonth.get(month) ?? 0;
    const grossProfit = revenue - (costByMonth.get(month) ?? 0);
    const repeatRate =
      customers.size === 0 ? 0 : round1((repeatCustomerCount / customers.size) * 100);

    return {
      month,
      revenue,
      grossProfit,
      repeatRate,
      customerCount: customers.size,
      repeatCustomerCount,
      revenueChangePercent: null,
      grossProfitChangePercent: null,
      repeatRateChangePoint: null,
    };
  });

  for (let index = 1; index < months.length; index += 1) {
    const current = months[index];
    const previous = months[index - 1];
    current.revenueChangePercent = changePercent(current.revenue, previous.revenue);
    current.grossProfitChangePercent = changePercent(current.grossProfit, previous.grossProfit);
    // 率の前月比を変化率で出すと「0%→38.5%」が発散し、値も直感に反する。
    // リピート率だけはポイント差で表示する
    current.repeatRateChangePoint = round1(current.repeatRate - previous.repeatRate);
  }

  const repeatCustomerCount = [...monthsByCustomer.values()].filter((set) => set.size >= 2).length;
  const customerCount = monthsByCustomer.size;
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);

  return {
    months,
    overall: {
      revenue: totalRevenue,
      grossProfit: totalRevenue - totalCost,
      repeatRate: customerCount === 0 ? 0 : round1((repeatCustomerCount / customerCount) * 100),
      customerCount,
      repeatCustomerCount,
    },
    categories: [...revenueByCategory.entries()]
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue || a.category.localeCompare(b.category)),
    skuRanking: [...skuTotals.values()]
      .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10),
  };
}
