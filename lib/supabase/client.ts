import { createBrowserClient } from "@supabase/ssr";

/** ブラウザから使うクライアント。Publishable key を使うため RLS が効く */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
