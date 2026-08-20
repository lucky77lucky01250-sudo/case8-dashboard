import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバーコンポーネント／サーバーアクションから使うクライアント。
 * ログイン中のユーザーとして振る舞うため Publishable key を使う（RLSが効く）。
 * 書き込みで RLS を迂回したい場合は Secret key を使う別のクライアントを用意すること
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // サーバーコンポーネントからは Cookie を書けない。
            // セッションの更新は proxy.ts が行うのでここは無視してよい
          }
        },
      },
    },
  );
}
