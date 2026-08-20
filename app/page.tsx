import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 本当の認可はここで行う。proxy.ts の判定は表示を速くするための予備であり、
  // それだけに頼るとプリフェッチや直接アクセスの経路で漏れる可能性がある
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">LUMINA 売上分析ダッシュボード</h1>
          <p className="mt-1 text-sm text-zinc-600">
            売上CSVをアップロードすると、KPI・月次推移・カテゴリ別・SKUランキングを表示します。
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">{user.email}</p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="mt-1 text-sm text-brand-navy underline underline-offset-4 hover:opacity-80"
            >
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <DashboardView />
    </main>
  );
}
