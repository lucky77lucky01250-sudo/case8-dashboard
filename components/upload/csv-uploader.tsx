"use client";

import { useRef, useState } from "react";
import { parseSalesCsv } from "@/lib/csv/parser";
import type { ParseResult } from "@/lib/csv/types";

type Props = {
  onParsed: (result: ParseResult, fileName: string) => void;
  onError: (message: string) => void;
};

export function CsvUploader({ onParsed, onError }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      onError(`CSVファイルを選択してください（選択されたファイル: ${file.name}）`);
      return;
    }

    setIsParsing(true);
    try {
      const result = await parseSalesCsv(file);
      if (result.missingColumns.length > 0) {
        onError(
          `必須の列が見つかりません: ${result.missingColumns.join(", ")}。` +
            "列名をご確認のうえ、もう一度アップロードしてください。",
        );
        return;
      }
      if (result.valid.length === 0) {
        onError("取り込める行がありませんでした。ファイルの内容をご確認ください。");
        return;
      }
      onParsed(result, file.name);
    } catch {
      onError("ファイルの読み込みに失敗しました。もう一度お試しください。");
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void handleFile(event.dataTransfer.files[0]);
      }}
      className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
        isDragging ? "border-brand-navy bg-brand-navy-5" : "border-zinc-300 bg-brand-light"
      }`}
    >
      <p className="text-base font-medium text-brand-navy">
        売上CSVをここにドラッグ＆ドロップ
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        必要な列: order_date / customer_id / product_name / category / sku / quantity / revenue / cost
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isParsing}
        className="mt-5 rounded-md bg-brand-navy px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isParsing ? "読み込み中…" : "ファイルを選択"}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
