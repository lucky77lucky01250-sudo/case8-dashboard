"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSending(true);

    const supabase = createClient();
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });

    setIsSending(false);

    if (sendError) {
      // 送信の失敗（回数制限など）は伝える必要がある
      setError("メールを送信できませんでした。しばらく待ってからお試しください。");
      return;
    }

    // 成功時は、そのアドレスが登録済みかどうかを明かさない文面にする
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-brand-navy-5 px-3 py-2 text-sm text-brand-navy">
          登録済みのアドレスであれば、再設定用のリンクをお送りしました。
        </p>
        <p className="text-xs leading-relaxed text-zinc-500">
          メールが届かない場合は、迷惑メールフォルダをご確認ください。
          それでも見つからない場合は、担当者までご連絡ください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
          メールアドレス
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-brand-navy focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSending}
        className="w-full rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isSending ? "送信中…" : "再設定用のリンクを送る"}
      </button>
    </form>
  );
}
