import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * サーバー専用クライアント。Secret key を使うため RLS を迂回する。
 * 書き込みはこのクライアントからのみ行う（schema.sql に insert ポリシーを作っていない）。
 *
 * 絶対にブラウザへ渡してはいけない。server-only を import しているので、
 * クライアントコンポーネントから読み込むとビルド時にエラーになる
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key || url === "ここに貼る" || key === "ここに貼る") {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
