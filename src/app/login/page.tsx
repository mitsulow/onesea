"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureAuthAlive } from "@/components/ServiceStatus";

/**
 * 静的ページ(ツキヨガ/シューマン)からのログイン入口。
 * /login?return=/tsukiyoga-v7/index.html のように来て、
 * Google認証 → /callback → onesea-return で元のページに戻る。
 * Auth窓口に8秒で繋がらなければ「Googleへ移動しています…」のまま固めず案内を出す(わらわ〜障害の教訓)。
 */
export default function LoginPage() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    // デバッグ: ?testdown=1 で障害時の案内を強制表示
    if (qs.has("testdown")) {
      setDown(true);
      return;
    }
    const ret = qs.get("return") || "/";
    try { localStorage.setItem("onesea-return", ret); } catch {}
    (async () => {
      if (!(await ensureAuthAlive())) {
        setDown(true);
        return;
      }
      const supabase = createClient();
      supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/callback`, queryParams: { prompt: "select_account" } },
      });
    })();
  }, []);

  return (
    <main
      className="flex min-h-dvh items-center justify-center"
      style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
    >
      {down ? (
        <div className="px-8 text-center">
          <p className="text-[14px] font-extrabold leading-relaxed text-[#f0b8a8]">
            ただ今アクセス集中により繋がりません。<br />10分後にまたお入りください🙏
          </p>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[#8aa8bc]">（投稿やデータは消えていません）</p>
          <button
            onClick={() => location.reload()}
            className="mx-auto mt-6 block rounded-2xl border border-[#d4b96a]/60 px-6 py-2.5 text-[13px] font-bold text-[#e8dcb8]"
          >
            もう一度ためす
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" />
          <p className="mt-4 text-[13px] tracking-[2px] text-[#b8ccda]">Googleへ移動しています…</p>
        </div>
      )}
    </main>
  );
}
