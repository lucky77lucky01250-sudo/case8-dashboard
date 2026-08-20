import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 で middleware は proxy に改名された。
 * ファイル名を middleware.ts のままにすると非推奨の扱いになる
 * （node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md）
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスで実行する:
     * - _next/static, _next/image: ビルド成果物
     * - favicon やアイコン・画像: 認証をかけると読み込めなくなる
     * - /api/health, /api/cron: 監視とCronは未ログインで叩ける必要がある
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
