import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * ログアウト。
 * GET ではなく POST のみ受ける。GET だと画像タグやプリフェッチで
 * 意図せずログアウトさせられる可能性があるため
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
