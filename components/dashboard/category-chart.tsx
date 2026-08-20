"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART_COLORS } from "@/lib/charts/colors";
import type { SalesSummary } from "@/lib/aggregate";
import { formatYen } from "@/lib/format";

type Props = { categories: SalesSummary["categories"]; totalRevenue: number };

export function CategoryChart({ categories, totalRevenue }: Props) {
  const data = categories.map((entry) => ({ ...entry, 売上: entry.revenue }));
  const categoryTotal = categories.reduce((sum, entry) => sum + entry.revenue, 0);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <h2 className="text-base font-semibold text-brand-navy">カテゴリ別売上</h2>
      <div className="mt-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" vertical={false} />
            {/*
              interval={0} を外すと幅が足りないときに Recharts がラベルを間引く。
              スマホで最も高い棒のラベルが消え、別のカテゴリが1位に見えてしまうため必須
            */}
            <XAxis
              dataKey="category"
              stroke="#71717A"
              fontSize={10}
              interval={0}
              tickMargin={6}
            />
            <YAxis
              stroke="#71717A"
              fontSize={12}
              tickFormatter={(value: number) => `${Math.round(value / 10000)}万`}
            />
            <Tooltip formatter={(value) => formatYen(Number(value))} />
            <Bar dataKey="売上" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* カテゴリ別の合計が売上合計と一致しない状態を画面上でも検知できるようにする */}
      {categoryTotal !== totalRevenue && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          カテゴリ別の合計（{formatYen(categoryTotal)}）が売上合計（{formatYen(totalRevenue)}）と
          一致していません。集計に問題があります。
        </p>
      )}
    </div>
  );
}
