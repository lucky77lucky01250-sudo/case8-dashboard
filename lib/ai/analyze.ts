import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { SalesSummary } from "../aggregate";
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisInput, buildUserMessage } from "./prompt";
import { estimateCost, formatCostLog } from "./cost";
import { buildMockAnalysis } from "./mock";
import { AnalysisSchema, analysisJsonSchema, type Analysis } from "./schema";

/**
 * 講義は claude-sonnet-4-6 を指定しているが、実装時点の現行モデルを使う（D-4）。
 * 月1回の呼び出しで入力2千トークン程度のため、費用は提案書の月500円に十分収まる
 */
const MODEL = "claude-opus-5";

const PLACEHOLDER = "ここに貼る";

export type AnalysisResult =
  | { status: "ok"; analysis: Analysis; model: string }
  | { status: "mock"; analysis: Analysis; reason: string }
  | { status: "error"; message: string };

export function isApiKeyConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return typeof key === "string" && key.length > 0 && key !== PLACEHOLDER;
}

export async function analyzeSales(summary: SalesSummary): Promise<AnalysisResult> {
  if (summary.months.length === 0) {
    return { status: "error", message: "集計できるデータがありません。" };
  }

  if (!isApiKeyConfigured()) {
    return {
      status: "mock",
      analysis: buildMockAnalysis(summary),
      reason: "ANTHROPIC_API_KEY が未設定のため、集計値から生成した仮のコメントを表示しています。",
    };
  }

  const input = buildAnalysisInput(summary);

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: ANALYSIS_SYSTEM_PROMPT,
          // 分析の指示文は毎回同じなのでキャッシュさせる
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: analysisJsonSchema() },
      },
      messages: [{ role: "user", content: buildUserMessage(input) }],
    });

    // 提案書の「月500円」を実測で裏づけるため、呼び出しごとに使用量を記録する
    const cost = estimateCost({
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    });
    console.log(formatCostLog(response.model, cost));

    // Claude Opus 5 は安全性の判断で応答を断ることがある。
    // content を読む前に stop_reason を確認しないと、ここで例外になる
    if (response.stop_reason === "refusal") {
      return {
        status: "error",
        message: "AIが分析を返しませんでした。データを確認のうえ、もう一度お試しください。",
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { status: "error", message: "AIの応答を読み取れませんでした。" };
    }

    const parsed = AnalysisSchema.safeParse(JSON.parse(textBlock.text));
    if (!parsed.success) {
      return { status: "error", message: "AIの応答が想定した形式ではありませんでした。" };
    }

    return { status: "ok", analysis: parsed.data, model: response.model };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { status: "error", message: "AIの利用が混み合っています。少し時間をおいてお試しください。" };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: "error", message: "APIキーが正しくありません。設定をご確認ください。" };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { status: "error", message: "AIに接続できませんでした。通信環境をご確認ください。" };
    }
    return { status: "error", message: "AI分析の生成に失敗しました。もう一度お試しください。" };
  }
}
