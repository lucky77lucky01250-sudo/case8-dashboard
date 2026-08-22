import { redirect } from "next/navigation";
import { DashboardView, type DashboardData } from "@/components/dashboard/dashboard-view";
import { aggregateSales } from "@/lib/aggregate";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { loadLatestReport, loadLatestUpload } from "@/lib/supabase/sales";

// 保存済みデータを毎回読みに行く。ビルド時のキャッシュを返すと古い数字が出る
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // 本当の認可はここで行う。proxy.ts の判定は表示を速くするための予備であり、
  // それだけに頼るとプリフェッチや直接アクセスの経路で漏れる可能性がある
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const stored = await loadLatestUpload();

  let initial: DashboardData | null = null;
  let loadError: string | null = null;

  if ("error" in stored) {
    // 読み込みに失敗したときに古い数字を出し続けないよう、
    // 空表示にしたうえで失敗を明示する（提案書 第9項(4)）
    loadError = stored.error;
  } else if (!("empty" in stored) && stored.rows.length > 0) {
    // 保存済みのコメントがあれば表示する。読み手それぞれが「生成」を押すと
    // API呼び出しが人数分になり、費用の前提が崩れるため
    const savedReport = await loadLatestReport(stored.upload.id);
    initial = {
      uploadId: stored.upload.id,
      savedReport,
      summary: aggregateSales(stored.rows),
      fileName: stored.upload.fileName,
      updatedAt: formatDateTime(stored.upload.uploadedAt),
      validRowCount: stored.rows.length,
      invalidRows: stored.invalid,
    };
  }

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

      {loadError && (
        <p className="mt-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          保存済みデータの読み込みに失敗しました。表示されている内容は最新ではない可能性があります。
          （{loadError}）
        </p>
      )}

      <DashboardView initial={initial} />
    </main>
  );
}
