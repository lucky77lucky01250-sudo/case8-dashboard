"use client";

import { useState, useTransition } from "react";
import { runAnalysis } from "@/app/actions/analyze";
import type { SalesSummary } from "@/lib/aggregate";
import type { AnalysisResult } from "@/lib/ai/analyze";

export type SavedReport = {
  model: string;
  createdAt: string;
  summary: string;
  highlights: string[];
  actions: { title: string; rationale: string; metric: string }[];
};

type Props = {
  summary: SalesSummary;
  uploadId: string | null;
  /** 保存済みのコメント。あればAPIを呼ばずにこれを表示する */
  savedReport: SavedReport | null;
};

export function AiAnalysis({ summary, uploadId, savedReport }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(
    savedReport
      ? {
          status: "ok",
          model: savedReport.model,
          analysis: {
            summary: savedReport.summary,
            highlights: savedReport.highlights,
            actions: savedReport.actions,
          },
        }
      : null,
  );
  const [isPending, startTransition] = useTransition();

  // 保存済みを表示しているあいだは、生成日時を出して古さが分かるようにする
  const savedAt = savedReport && result?.status === "ok" && result.model === savedReport.model
    ? savedReport.createdAt
    : null;

  function generate() {
    startTransition(async () => {
      setResult(await runAnalysis(summary, uploadId));
    });
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-brand-navy">AI分析コメント</h2>
          <p className="mt-1 text-xs text-zinc-500">
            集計後の数値のみをAIに送信します。お客様のIDや注文明細は送信しません。
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "生成中…" : result ? "もう一度生成する" : "コメントを生成する"}
        </button>
      </div>

      {result?.status === "error" && (
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">{result.message}</p>
      )}

      {result?.status === "mock" && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {result.reason}
        </p>
      )}

      {(result?.status === "ok" || result?.status === "mock") && (
        <div className="mt-4 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700">サマリー</h3>
            <p className="mt-1 text-sm leading-relaxed text-zinc-900">{result.analysis.summary}</p>
          </div>

          {result.analysis.highlights.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-700">注目点</h3>
              <ul className="mt-1 space-y-1">
                {result.analysis.highlights.map((highlight) => (
                  <li key={highlight} className="text-sm leading-relaxed text-zinc-900">
                    ・{highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-zinc-700">アクション提案</h3>
            <ol className="mt-2 space-y-3">
              {result.analysis.actions.map((action, index) => (
                <li
                  key={action.title}
                  className="rounded-md border border-zinc-200 bg-brand-light p-4"
                >
                  <p className="text-sm font-medium text-brand-navy">
                    {index + 1}. {action.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{action.rationale}</p>
                  <p className="mt-1 text-xs text-zinc-500">確認する数字: {action.metric}</p>
                </li>
              ))}
            </ol>
          </div>

          <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            {result.status === "ok"
              ? `${result.model} が生成しました${savedAt ? `（${new Date(savedAt).toLocaleString("ja-JP")}）` : ""}。AIの出力は100%正確にはなりません。内容をご確認のうえ、必要に応じて加筆してください。`
              : "APIキー設定後は、実際のAIコメントに置き換わります。"}
          </p>
        </div>
      )}
    </section>
  );
}
