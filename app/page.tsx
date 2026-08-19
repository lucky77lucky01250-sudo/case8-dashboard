"use client";

import { useMemo, useState } from "react";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { SkuTable } from "@/components/dashboard/sku-table";
import { CsvUploader } from "@/components/upload/csv-uploader";
import { ImportSummary } from "@/components/upload/import-summary";
import { aggregateSales } from "@/lib/aggregate";
import type { ParseResult } from "@/lib/csv/types";
import {
  formatChangePercent,
  formatChangePoint,
  formatMonth,
  formatPercent,
  formatYen,
} from "@/lib/format";

type Upload = { result: ParseResult; fileName: string; updatedAt: string };

function directionOf(value: number | null): "up" | "down" | "flat" | null {
  if (value === null) return null;
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export default function DashboardPage() {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const summary = useMemo(
    () => (upload ? aggregateSales(upload.result.valid) : null),
    [upload],
  );

  const currentMonth = useMemo(() => {
    if (!summary || summary.months.length === 0) return null;
    return (
      summary.months.find((entry) => entry.month === selectedMonth) ??
      summary.months[summary.months.length - 1]
    );
  }, [summary, selectedMonth]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="border-b border-zinc-200 pb-5">
        <h1 className="text-2xl font-bold text-brand-navy">LUMINA 売上分析ダッシュボード</h1>
        <p className="mt-1 text-sm text-zinc-600">
          売上CSVをアップロードすると、KPI・月次推移・カテゴリ別・SKUランキングを表示します。
        </p>
      </header>

      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <section className="mt-6">
        {upload === null ? (
          <CsvUploader
            onParsed={(result, fileName) => {
              setError(null);
              setSelectedMonth(null);
              setUpload({
                result,
                fileName,
                updatedAt: new Date().toLocaleString("ja-JP"),
              });
            }}
            onError={(message) => setError(message)}
          />
        ) : (
          <div className="space-y-3">
            <ImportSummary
              result={upload.result}
              fileName={upload.fileName}
              updatedAt={upload.updatedAt}
            />
            <button
              type="button"
              onClick={() => {
                setUpload(null);
                setError(null);
              }}
              className="text-sm text-brand-navy underline underline-offset-4 hover:opacity-80"
            >
              別のCSVをアップロードする
            </button>
          </div>
        )}
      </section>

      {summary && currentMonth && (
        <>
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-brand-navy">
                {formatMonth(currentMonth.month)}の実績
              </h2>
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                表示する月
                <select
                  value={currentMonth.month}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900"
                >
                  {summary.months.map((entry) => (
                    <option key={entry.month} value={entry.month}>
                      {formatMonth(entry.month)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <KpiCard
                label="売上"
                value={formatYen(currentMonth.revenue)}
                change={formatChangePercent(currentMonth.revenueChangePercent)}
                changeDirection={directionOf(currentMonth.revenueChangePercent)}
                definition="その月に発生した売上の合計（revenue列の合計）"
              />
              <KpiCard
                label="粗利"
                value={formatYen(currentMonth.grossProfit)}
                change={formatChangePercent(currentMonth.grossProfitChangePercent)}
                changeDirection={directionOf(currentMonth.grossProfitChangePercent)}
                definition="売上 − 原価（revenue − cost）"
              />
              <KpiCard
                label="リピート率（月次）"
                value={formatPercent(currentMonth.repeatRate)}
                change={formatChangePoint(currentMonth.repeatRateChangePoint)}
                changeDirection={directionOf(currentMonth.repeatRateChangePoint)}
                definition={`その月に購入した ${currentMonth.customerCount} 名のうち、それ以前の月にも購入がある ${currentMonth.repeatCustomerCount} 名の割合。前月比はポイント差で表示します。`}
              />
            </div>
          </section>

          {/* D-1: 期間累計は月次とは別物の数字なので、別枠で定義を添えて出す */}
          <section className="mt-6 rounded-lg border border-zinc-200 bg-brand-light p-5">
            <h2 className="text-base font-semibold text-brand-navy">
              期間全体（{formatMonth(summary.months[0].month)} 〜{" "}
              {formatMonth(summary.months[summary.months.length - 1].month)}）
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-zinc-600">売上合計</p>
                <p className="text-xl font-bold tabular-nums text-brand-navy">
                  {formatYen(summary.overall.revenue)}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-600">粗利合計</p>
                <p className="text-xl font-bold tabular-nums text-brand-navy">
                  {formatYen(summary.overall.grossProfit)}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-600">リピート率（期間累計）</p>
                <p className="text-xl font-bold tabular-nums text-brand-navy">
                  {formatPercent(summary.overall.repeatRate)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              期間累計のリピート率は「期間内で2ヶ月以上購入したお客様の割合」です（
              {summary.overall.customerCount} 名中 {summary.overall.repeatCustomerCount} 名）。
              上のKPIカードの月次リピート率とは定義が異なります。
            </p>
          </section>

          <section className="mt-6">
            <MonthlyTrendChart months={summary.months} />
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <CategoryChart
              categories={summary.categories}
              totalRevenue={summary.overall.revenue}
            />
            <SkuTable skuRanking={summary.skuRanking} />
          </section>
        </>
      )}
    </main>
  );
}
