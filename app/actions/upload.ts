"use server";

import { revalidatePath } from "next/cache";
import type { InvalidRow, SaleRow } from "@/lib/csv/types";
import { createClient } from "@/lib/supabase/server";
import { saveUpload } from "@/lib/supabase/sales";

export type SaveUploadResult =
  | { status: "saved"; uploadId: string }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

/**
 * アップロードした売上データを保存する。
 * 保存しておくことで、読み手7名のうちアップロードした人以外も
 * 画面を開くだけで最新の数字を見られる
 */
export async function persistUpload(params: {
  fileName: string;
  rows: SaleRow[];
  invalid: InvalidRow[];
}): Promise<SaveUploadResult> {
  // サーバーアクションは誰でも呼べる入口なので、必ず認証を確認する
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "error", message: "ログインが必要です。" };

  if (params.rows.length === 0) {
    return { status: "skipped", reason: "保存できる有効行がありません。" };
  }

  const result = await saveUpload(params);
  if ("error" in result) return { status: "error", message: result.error };

  revalidatePath("/");
  return { status: "saved", uploadId: result.uploadId };
}
