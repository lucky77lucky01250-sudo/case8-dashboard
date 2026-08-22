import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * パスワード再設定メールのリンクの受け口。
 * リンクに付いてくる code をセッションに交換してから、再設定画面へ送る
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/reset-password";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // 期限切れや使用済みのリンクはここに来る
    return NextResponse.redirect(new URL("/login?error=expired_link", request.url));
  }

  // next は自サイト内のパスに限定する（オープンリダイレクト対策）
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/auth/reset-password";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
