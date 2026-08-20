/**
 * Supabase の設定が意図どおりかを検証する。
 *
 *   pnpm verify:supabase
 *
 * 検収の場で「第三者は入れません」を口頭で説明する代わりに、
 * これを実行して見せられるようにしている。
 * 設定変更のあとや、環境を作り直したあとにも実行すること。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (t && !t.startsWith("#") && t.includes("=")) {
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1).trim();
  }
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error("`.env.local` に Supabase の3つの値を設定してください。");
  process.exit(1);
}

const secret = createClient(url, secretKey);
const publishable = createClient(url, publishableKey);

const TABLES = ["uploads", "sales_data", "skipped_rows", "reports", "health_pings"];
const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  OK " : "  NG "} ${name}${detail ? ` — ${detail}` : ""}`);
};

console.log("\n■ テーブルが揃っているか");
for (const table of TABLES) {
  const { error } = await secret.from(table).select("*").limit(1);
  record(table, !error, error?.message);
}

console.log("\n■ 未ログインの第三者がデータを読めないか（RLS）");
for (const table of TABLES) {
  const { data, error } = await publishable.from(table).select("*").limit(1);
  const blocked = error !== null || (data ?? []).length === 0;
  record(`${table} は読めない`, blocked, error ? `拒否 ${error.code}` : `返却 ${(data ?? []).length} 行`);
}

console.log("\n■ 未ログインの第三者がデータを書き込めないか");
{
  const { error } = await publishable.from("health_pings").insert({});
  record("health_pings へ書き込めない", error !== null, error ? `拒否 ${error.code}` : "書き込めてしまった");
}

console.log("\n■ 第三者が勝手にアカウントを作れないか");
{
  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email: `verify-${Date.now()}@example.com`, password: "Test-Password-123" }),
  });
  const payload = await response.json().catch(() => ({}));
  record("サインアップが拒否される", !response.ok, `HTTP ${response.status} ${payload.msg ?? ""}`);
}

console.log("\n■ 認証設定");
{
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey } });
  const settings = await response.json();
  record("公開サインアップが無効", settings.disable_signup === true);
  record("匿名サインインが無効", !settings.external_anonymous);
  record("メール確認が必須", settings.mailer_autoconfirm === false);
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${failed.length === 0 ? "すべて問題ありません" : `★ ${failed.length} 件の問題があります`}` +
    ` （${results.length - failed.length}/${results.length}）\n`,
);
process.exit(failed.length === 0 ? 0 : 1);
