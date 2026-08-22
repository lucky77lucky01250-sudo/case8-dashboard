import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "ログイン | LUMINA 売上分析ダッシュボード" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-xl font-bold text-brand-navy">LUMINA 売上分析ダッシュボード</h1>
      <p className="mt-1 text-sm text-zinc-600">
        ご登録のメールアドレスとパスワードでログインしてください。
      </p>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-6">
        <LoginForm nextPath={next} />
      </div>

      <Link
        href="/auth/forgot-password"
        className="mt-4 text-sm text-brand-navy underline underline-offset-4 hover:opacity-80"
      >
        パスワードをお忘れの方
      </Link>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        アカウントは管理者が登録します。ログインできない場合は担当者までご連絡ください。
      </p>
    </main>
  );
}
