"use server";

import { analyzeSales, type AnalysisResult } from "@/lib/ai/analyze";
import type { SalesSummary } from "@/lib/aggregate";
import { createClient } from "@/lib/supabase/server";
import { saveReport } from "@/lib/supabase/sales";

/**
 * 画面からは集計結果だけを渡す。明細（顧客IDを含む）はサーバーへ送らない。
 * 生成したコメントは保存し、次に開いた人は生成せずに読めるようにする
 */
export async function runAnalysis(
  summary: SalesSummary,
  uploadId: string | null,
): Promise<AnalysisResult> {
  // サーバーアクションは誰でも呼べる入口なので、必ず認証を確認する。
  // AI呼び出しは費用が発生するため、未ログインで叩かれるのは実害がある
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "ログインが必要です。" };
  }

  const result = await analyzeSales(summary);

  if (result.status === "ok" && uploadId) {
    // 保存に失敗しても生成結果は返す。表示できるものを消す必要はない
    await saveReport({
      uploadId,
      model: result.model,
      summary: result.analysis.summary,
      highlights: result.analysis.highlights,
      actions: result.analysis.actions,
    });
  }

  return result;
}
