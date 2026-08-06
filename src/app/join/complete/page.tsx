"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/cotozute";
import { isWarawaUntil } from "@/lib/warawa";

/**
 * わらわ〜会員の入金後ランディング。LP（模擬Stripeボタン）から戻ってきた人が着地。
 * ログイン確認 → warawa_until(+1年)を付与 → マイページへ。
 * 足りない情報（携帯・市町村・DDP）はマイページの未入力カード+バッジで催促する。
 * ※模擬システム: 後日 Stripe webhook の決済確認でサーバー側付与に差し替え。
 */
export default function JoinCompletePage() {
  const router = useRouter();
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user;
      if (!user) {
        setNeedLogin(true);
        return;
      }
      await ensureProfile(user);
      const { data: prof } = await supabase.from("profiles").select("warawa_until").eq("id", user.id).maybeSingle();
      if (!isWarawaUntil(prof?.warawa_until as string | null)) {
        const until = new Date();
        until.setFullYear(until.getFullYear() + 1); // 年会費: 1年分
        await supabase.from("profiles").update({ warawa_until: until.toISOString() }).eq("id", user.id);
      }
      router.replace("/my");
    });
  }, [router]);

  const login = async () => {
    try {
      localStorage.setItem("onesea-return", "/join/complete");
    } catch {}
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  };

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
    >
      {needLogin ? (
        <>
          <h1 className="text-[19px] font-extrabold tracking-[3px] text-[#f0e6c8]">
            ご入金ありがとうございます
          </h1>
          <p className="mt-3 text-[13px] leading-loose text-[#b8ccda]">
            Googleでログインすると、わらわ〜会員が有効になります。
          </p>
          <button
            onClick={login}
            className="mt-6 w-full max-w-[300px] rounded-2xl bg-white py-3.5 text-[14.5px] font-extrabold text-[#3a3428]"
          >
            Googleでログイン
          </button>
        </>
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d4b96a] border-t-transparent" />
      )}
    </main>
  );
}
