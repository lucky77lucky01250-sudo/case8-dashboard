import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Supabase Free は1週間アクセスがないと自動停止するため、Vercel Cron から日次で叩く。
 *
 * GitHub Actions のスケジュール実行は使わない（リポジトリが60日無活動だと
 * 自動停止し、保守契約が切れた後に静かに壊れるため。CLAUDE.md 確定仕様）
 */
export async function GET(request: Request) {
  // Vercel Cron は Authorization: Bearer $CRON_SECRET を付けて呼ぶ。
  // 設定していれば外部から叩かれても弾ける
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url === "ここに貼る" || key === "ここに貼る") {
    return NextResponse.json({ status: "skipped", reason: "not_configured" });
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase.from("health_pings").insert({});
    if (error) {
      return NextResponse.json(
        { status: "error", reason: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ status: "ok", pingedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "error", reason: "unreachable" }, { status: 500 });
  }
}
