"use client";

import { useMemo, useState, useTransition } from "react";
import { persistUpload } from "@/app/actions/upload";
import { AiAnalysis, type SavedReport } from "@/components/dashboard/ai-analysis";
import { CategoryChart } from "@/components/dashboard/category-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { SkuTable } from "@/components/dashboard/sku-table";
import { CsvUploader } from "@/components/upload/csv-uploader";
import { ImportSummary } from "@/components/upload/import-summary";
import { aggregateSales, type SalesSummary } from "@/lib/aggregate";
import type { InvalidRow } from "@/lib/csv/types";
import {
  formatChangePercent,
  formatChangePoint,
  formatMonth,
  formatPercent,
  formatYen,
} from "@/lib/format";

export type DashboardData = {
  uploadId: string | null;
  summary: SalesSummary;
  fileName: string;
  updatedAt: string;
  validRowCount: number;
  invalidRows: InvalidRow[];
  savedReport: SavedReport | null;
};

type View = DashboardData & { storage: "saved" | "saving" | "unsaved" };

function directionOf(value: number | null): "up" | "down" | "flat" | null {
  if (value === null) return null;
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function DashboardView({ initial }: { initial: DashboardData | null }) {
  const [view, setView] = useState<View | null>(
    initial ? { ...initial, storage: "saved" } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [, startTransition] = useTransition();

  const summary = view?.summary ?? null;

  const currentMonth = useMemo(() => {
    if (!summary || summary.months.length === 0) return null;
    return (
      summary.months.find((entry) => entry.month === selectedMonth) ??
      summary.months[summary.months.length - 1]
    );
  }, [summary, selectedMonth]);

  return (
    <>
      {error && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <section className="mt-6 space-y-3">
        {view && (
          <ImportSummary
            validRowCount={view.validRowCount}
            invalidRows={view.invalidRows}
            fileName={view.fileName}
            updatedAt={view.updatedAt}
            storage={view.storage}
          />
        )}

        {view && !isUploaderOpen && (
          <button
            type="button"
            onClick={() => setIsUploaderOpen(true)}
            className="text-sm text-brand-navy underline underline-offset-4 hover:opacity-80"
          >
            別のCSVをアップロードする
          </button>
        )}

        {(view === null || isUploaderOpen) && (
          <CsvUploader
            onParsed={(result, fileName) => {
              setError(null);
              setSelectedMonth(null);
              setIsUploaderOpen(false);

              const next: View = {
                uploadId: null,
                savedReport: null,
                summary: aggregateSales(result.valid),
                fileName,
                updatedAt: new Date().toLocaleString("ja-JP"),
                validRowCount: result.valid.length,
                invalidRows: result.invalid,
                storage: "saving",
              };
              setView(next);

              startTransition(async () => {
                const saved = await persistUpload({
                  fileName,
                  rows: result.valid,
                  invalid: result.invalid,
                });
                if (saved.status === "saved") {
                  setView((current) =>
                    current
                      ? { ...current, storage: "saved", uploadId: saved.uploadId }
                      : current,
                  );
                } else {
                  // 保存できていないのに保存済みに見せない。
                  // 画面の数字自体は正しいので、消さずに状態だけ伝える
                  setView((current) => (current ? { ...current, storage: "unsaved" } : current));
                  setError(
                    saved.status === "error"
                      ? `画面には表示していますが、保存に失敗しました: ${saved.message}`
                      : saved.reason,
                  );
                }
              });
            }}
            onError={(message) => setError(message)}
          />
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

          <section className="mt-6">
            <AiAnalysis
              summary={summary}
              uploadId={view?.uploadId ?? null}
              savedReport={view?.savedReport ?? null}
            />
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
    </>
  );
}
