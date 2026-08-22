import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = { title: "パスワードの再設定 | LUMINA 売上分析ダッシュボード" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-xl font-bold text-brand-navy">パスワードの再設定</h1>
      <p className="mt-1 text-sm text-zinc-600">
        ご登録のメールアドレスに、再設定用のリンクをお送りします。
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <ForgotPasswordForm />
      </div>

      <Link
        href="/login"
        className="mt-4 text-sm text-brand-navy underline underline-offset-4 hover:opacity-80"
      >
        ログイン画面に戻る
      </Link>
    </main>
  );
}
