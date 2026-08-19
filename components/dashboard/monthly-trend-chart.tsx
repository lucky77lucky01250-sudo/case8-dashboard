"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KPI_COLORS } from "@/lib/charts/colors";
import type { MonthlyKpi } from "@/lib/aggregate";
import { formatMonthShort, formatPercent, formatYen } from "@/lib/format";

type Props = { months: MonthlyKpi[] };

/**
 * 提案書43行の「3つのKPIを折れ線で可視化」。
 * 金額（円）と率（%）はスケールが違うため軸を左右に分ける
 */
export function MonthlyTrendChart({ months }: Props) {
  const data = months.map((entry) => ({
    month: formatMonthShort(entry.month),
    売上: entry.revenue,
    粗利: entry.grossProfit,
    リピート率: entry.repeatRate,
  }));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-brand-navy">月次推移</h2>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
            <XAxis dataKey="month" stroke="#71717A" fontSize={12} />
            <YAxis
              yAxisId="amount"
              stroke="#71717A"
              fontSize={12}
              tickFormatter={(value: number) => `${Math.round(value / 10000)}万`}
            />
            <YAxis
              yAxisId="rate"
              orientation="right"
              domain={[0, 100]}
              stroke="#71717A"
              fontSize={12}
              tickFormatter={(value: number) => `${value}%`}
            />
            <Tooltip
              formatter={(value, name) =>
                name === "リピート率" ? formatPercent(Number(value)) : formatYen(Number(value))
              }
            />
            <Legend />
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="売上"
              stroke={KPI_COLORS.revenue}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              yAxisId="amount"
              type="monotone"
              dataKey="粗利"
              stroke={KPI_COLORS.grossProfit}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Line
              yAxisId="rate"
              type="monotone"
              dataKey="リピート率"
              stroke={KPI_COLORS.repeatRate}
              strokeWidth={2}
              strokeDasharray="4 3"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">
        売上・粗利は左軸（円）、リピート率は右軸（%）。
        リピート率は「その月に購入した顧客のうち、それ以前の月にも購入がある顧客の割合」です。
        最初の月は比較対象となる過去月がないため 0.0% と表示されます。
      </p>
    </div>
  );
}
