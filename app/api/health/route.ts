import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 外部監視（UptimeRobot）の宛先。
 * Supabase へ軽いクエリを投げ、成功なら 200 / 失敗なら 500 を返す。
 *
 * HEALTH_FORCE_FAIL=1 を設定すると意図的に 500 を返す。
 * 検収の場で「わざと応答しない状態を作って通知が届くところをお見せする」
 * ための分岐（CLAUDE.md 通知経路の実測 手順4）
 */
export async function GET() {
  if (process.env.HEALTH_FORCE_FAIL === "1") {
    return NextResponse.json(
      { status: "error", reason: "forced_failure" },
      { status: 500 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Supabase 接続前でも監視を先に始められるよう、未設定は障害扱いにしない。
  // 接続後にこの分岐へ入ることは無いので、設定漏れの検知にもなる
  if (!url || !key || url === "ここに貼る" || key === "ここに貼る") {
    return NextResponse.json({ status: "ok", database: "not_configured" });
  }

  try {
    const supabase = createClient(url, key);
    const { error } = await supabase
      .from("uploads")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { status: "error", database: "query_failed", reason: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ status: "ok", database: "reachable" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 500 },
    );
  }
}
