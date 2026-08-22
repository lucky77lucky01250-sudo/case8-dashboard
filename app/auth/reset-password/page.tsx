import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "新しいパスワードの設定 | LUMINA 売上分析ダッシュボード" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // メールのリンクを経由していないとセッションが無い。
  // 直接この URL を開いただけでパスワードを変えられてはいけない
  if (!user) redirect("/auth/forgot-password?error=no_session");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-xl font-bold text-brand-navy">新しいパスワードの設定</h1>
      <p className="mt-1 text-sm text-zinc-600">{user.email} のパスワードを変更します。</p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <ResetPasswordForm />
      </div>
    </main>
  );
}
