import { z } from "zod";

/**
 * AI分析コメントの構造。
 * 提案書の約束「JSON構造化で型を固定」を、講義の正規表現抽出ではなく
 * 構造化出力（output_config.format）で満たす（D-3 #9）
 */
export const AnalysisSchema = z.object({
  /** 社長・マーケ部長向けのサマリー（コンサルトーン） */
  summary: z.string(),
  /** 数字の裏づけがある注目点 */
  highlights: z.array(z.string()),
  /** アクション提案。検収基準(3)の「検討に値する具体性」を満たすこと */
  actions: z.array(
    z.object({
      /** 何をするか。「広告を強化する」のような一般論は不可 */
      title: z.string(),
      /** なぜそうするのか。根拠となる数字を含める */
      rationale: z.string(),
      /** 効果をどの数字で確認するか */
      metric: z.string(),
    }),
  ),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

/**
 * API へ渡す JSON Schema。zod を正本にして生成するので二重管理にならない。
 * $schema キーは Messages API の構造化出力では不要なため落とす
 */
export function analysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(AnalysisSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
