"use client";

import { useState } from "react";
import { invalidRowsToCsv } from "@/lib/csv/parser";
import type { InvalidRow } from "@/lib/csv/types";

type Props = {
  /** 取り込めた行数。DBから復元したときも表示できるよう件数だけ受け取る */
  validRowCount: number;
  invalidRows: InvalidRow[];
  fileName: string;
  updatedAt: string;
  /** 保存の状態。保存できていないのに保存済みに見えるのを防ぐ */
  storage?: "saved" | "unsaved" | "saving";
};

/**
 * 講義の「無効行を捨てない」要件。
 * 何行取り込めて何行スキップしたかを必ず出し、スキップ行はCSVで持ち帰れるようにする
 */
export function ImportSummary({
  validRowCount,
  invalidRows,
  fileName,
  updatedAt,
  storage,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const skipped = invalidRows.length;

  function downloadSkippedRows() {
    const csv = invalidRowsToCsv(invalidRows);
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `skipped-rows_${fileName}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-600">{fileName}</p>
          <p className="mt-1 text-base">
            <span className="font-semibold text-brand-navy">{validRowCount} 行成功</span>
            <span className="mx-2 text-zinc-300">/</span>
            <span className={skipped > 0 ? "font-semibold text-amber-700" : "text-zinc-500"}>
              {skipped} 行スキップ
            </span>
          </p>
          {/* 検収基準(4): 古い数字を出し続けないよう最終更新日時を必ず表示する */}
          <p className="mt-1 text-xs text-zinc-500">
            最終更新 {updatedAt}
            {storage === "saving" && <span className="ml-2 text-zinc-400">保存中…</span>}
            {storage === "saved" && <span className="ml-2 text-zinc-400">保存済み</span>}
            {storage === "unsaved" && (
              <span className="ml-2 text-amber-700">未保存（この画面を閉じると失われます）</span>
            )}
          </p>
        </div>

        {skipped > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsOpen((open) => !open)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {isOpen ? "内訳を閉じる" : "内訳を見る"}
            </button>
            <button
              type="button"
              onClick={downloadSkippedRows}
              className="rounded-md border border-brand-navy px-3 py-1.5 text-sm text-brand-navy hover:bg-brand-navy-5"
            >
              スキップ行をCSVで保存
            </button>
          </div>
        )}
      </div>

      {skipped > 0 && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          スキップした行は集計に含まれていません。合計金額が想定と異なる場合は内訳をご確認ください。
        </p>
      )}

      {isOpen && (
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
              <tr>
                <th className="w-24 px-3 py-2 font-medium">行番号</th>
                <th className="px-3 py-2 font-medium">スキップした理由</th>
              </tr>
            </thead>
            <tbody>
              {invalidRows.map((row) => (
                <tr key={row.line} className="border-t border-zinc-100">
                  <td className="px-3 py-2 tabular-nums text-zinc-500">{row.line}</td>
                  <td className="px-3 py-2 text-zinc-800">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
