"use server";

import { analyzeSales, type AnalysisResult } from "@/lib/ai/analyze";
import type { SalesSummary } from "@/lib/aggregate";

/**
 * 画面からは集計結果だけを渡す。明細（顧客IDを含む）はサーバーへ送らない。
 * Supabase を接続したら、集計もサーバー側で行うよう差し替える
 */
export async function runAnalysis(summary: SalesSummary): Promise<AnalysisResult> {
  return analyzeSales(summary);
}
