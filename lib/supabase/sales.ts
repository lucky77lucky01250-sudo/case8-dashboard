import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvalidRow, SaleRow } from "../csv/types";
import { createAdminClient } from "./admin";
import { fetchAllPages } from "./paginate";

/**
 * PostgREST は1回のクエリで最大1,000行しか返さない。
 * 本番データが1,000行を超えるのは確実なので、素直に select すると
 * 黙って1,000行だけ取得され、合計金額が実際より小さくなる。
 * 「数字が一致すること」（提案書 第9項(1)）を静かに壊す経路なので必ずページングする
 */
const PAGE_SIZE = 1000;

/** 一度に insert する行数。大きすぎるとリクエストが通らない */
const INSERT_CHUNK = 500;

export type StoredUpload = {
  id: string;
  fileName: string;
  uploadedAt: string;
  validRowCount: number;
  invalidRowCount: number;
};

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * アップロード1回分を保存する。
 * 明細の保存に失敗したら uploads も消す。
 * 中途半端な状態が残ると「40行成功」と表示しながら実際には30行しか
 * 入っていない、という数字のズレになるため
 */
export async function saveUpload(params: {
  fileName: string;
  rows: SaleRow[];
  invalid: InvalidRow[];
}): Promise<{ uploadId: string } | { error: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { error: "Supabase が設定されていません。" };

  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .insert({
      file_name: params.fileName,
      valid_row_count: params.rows.length,
      invalid_row_count: params.invalid.length,
    })
    .select("id")
    .single();

  if (uploadError || !upload) {
    return { error: uploadError?.message ?? "アップロードの記録に失敗しました。" };
  }

  const uploadId = upload.id as string;

  const salesRows = params.rows.map((row) => ({
    upload_id: uploadId,
    order_date: row.orderDate,
    customer_id: row.customerId,
    product_name: row.productName,
    category: row.category,
    sku: row.sku,
    quantity: row.quantity,
    revenue: row.revenue,
    cost: row.cost,
  }));

  for (const part of chunk(salesRows, INSERT_CHUNK)) {
    const { error } = await supabase.from("sales_data").insert(part);
    if (error) {
      await supabase.from("uploads").delete().eq("id", uploadId);
      return { error: `売上明細の保存に失敗しました: ${error.message}` };
    }
  }

  if (params.invalid.length > 0) {
    const skipped = params.invalid.map((row) => ({
      upload_id: uploadId,
      line_number: row.line,
      reason: row.reason,
      raw_row: row.raw,
    }));
    for (const part of chunk(skipped, INSERT_CHUNK)) {
      const { error } = await supabase.from("skipped_rows").insert(part);
      if (error) {
        await supabase.from("uploads").delete().eq("id", uploadId);
        return { error: `スキップ行の保存に失敗しました: ${error.message}` };
      }
    }
  }

  return { uploadId };
}

async function fetchAllSaleRows(
  supabase: SupabaseClient,
  uploadId: string,
): Promise<SaleRow[] | { error: string }> {
  let failure: string | null = null;

  const raw = await fetchAllPages(PAGE_SIZE, async (from, to) => {
    if (failure) return [];

    const { data, error, status } = await supabase
      .from("sales_data")
      .select("order_date, customer_id, product_name, category, sku, quantity, revenue, cost")
      .eq("upload_id", uploadId)
      .order("id", { ascending: true })
      .range(from, to);

    // エラーだけでなく HTTP ステータスも見る（D-8 と同じ理由）
    if (error || status >= 400) {
      failure = error?.message ?? `売上明細の取得に失敗しました（HTTP ${status}）`;
      return [];
    }
    return data ?? [];
  });

  if (failure) return { error: failure };

  return raw.map((row) => {
    const orderDate = row.order_date as string;
    return {
      orderDate,
      month: orderDate.slice(0, 7),
      customerId: row.customer_id as string,
      productName: row.product_name as string,
      category: row.category as string,
      sku: row.sku as string,
      quantity: row.quantity as number,
      revenue: row.revenue as number,
      cost: row.cost as number,
    };
  });
}

/** 最新のアップロードを、明細・スキップ行とあわせて取得する */
export async function loadLatestUpload(): Promise<
  | { upload: StoredUpload; rows: SaleRow[]; invalid: InvalidRow[] }
  | { empty: true }
  | { error: string }
> {
  const supabase = createAdminClient();
  if (!supabase) return { empty: true };

  const { data: uploads, error, status } = await supabase
    .from("uploads")
    .select("id, file_name, uploaded_at, valid_row_count, invalid_row_count")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error || status >= 400) {
    return { error: error?.message ?? `アップロード履歴の取得に失敗しました（HTTP ${status}）` };
  }
  if (!uploads || uploads.length === 0) return { empty: true };

  const record = uploads[0];
  const uploadId = record.id as string;

  const rows = await fetchAllSaleRows(supabase, uploadId);
  if ("error" in rows) return rows;

  const { data: skipped } = await supabase
    .from("skipped_rows")
    .select("line_number, reason, raw_row")
    .eq("upload_id", uploadId)
    .order("line_number", { ascending: true });

  return {
    upload: {
      id: uploadId,
      fileName: record.file_name as string,
      uploadedAt: record.uploaded_at as string,
      validRowCount: record.valid_row_count as number,
      invalidRowCount: record.invalid_row_count as number,
    },
    rows,
    invalid: (skipped ?? []).map((row) => ({
      line: row.line_number as number,
      reason: row.reason as string,
      raw: (row.raw_row ?? {}) as Record<string, string>,
    })),
  };
}

/** AI分析コメントを保存する */
export async function saveReport(params: {
  uploadId: string;
  model: string;
  summary: string;
  highlights: string[];
  actions: unknown[];
}): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  if (!supabase) return { error: "Supabase が設定されていません。" };

  const { error } = await supabase.from("reports").insert({
    upload_id: params.uploadId,
    model: params.model,
    summary: params.summary,
    highlights: params.highlights,
    action_items: params.actions,
  });

  return error ? { error: error.message } : {};
}
