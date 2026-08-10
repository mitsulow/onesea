"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 静的ページ(ツキヨガ/シューマン)からのログイン入口。
 * /login?return=/tsukiyoga-v7/index.html のように来て、
 * Google認証 → /callback → onesea-return で元のページに戻る。
 */
export default function LoginPage() {
  useEffect(() => {
    const ret = new URLSearchParams(window.location.search).get("return") || "/";
    try { localStorage.setItem("onesea-return", ret); } catch {}
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback`, queryParams: { prompt: "select_account" } },
    });
  }, []);

  return (
    <main
      className="flex min-h-dvh items-center justify-center"
      style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
    >
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" />
        <p className="mt-4 text-[13px] tracking-[2px] text-[#b8ccda]">Googleへ移動しています…</p>
      </div>
    </main>
  );
}
