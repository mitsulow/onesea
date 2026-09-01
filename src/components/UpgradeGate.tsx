"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureAuthAlive } from "@/components/ServiceStatus";
import { WARAWA_LP_URL } from "@/lib/warawa";

/**
 * プレミアム（わらわ〜会員）専用機能に触れたときの案内。
 * 無料会員・ゲスト共通: 「詳しくはコチラ→」でLP（後日Stripe決済ページに差し替え）へ。
 */
export function UpgradeDialog({
  open,
  onClose,
  feature,
  lp,
}: {
  open: boolean;
  onClose: () => void;
  feature?: string;
  lp?: string; // サービスLP（例: /lp/mmm）。あればそこへ、無ければ中央キャンペーンへ
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  const detailHref = lp ?? WARAWA_LP_URL;

  const login = async () => {
    if (!(await ensureAuthAlive())) return; // 障害中は赤帯を出して固まらせない
    try {
      localStorage.removeItem("onesea-return");
    } catch {}
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback`, queryParams: { prompt: "select_account" } },
    });
  };

  return createPortal(
    /* 背景タップでは閉じない: 読む前に消える事故を防ぐ(閉じるのは「閉じる」ボタンだけ) */
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[340px] rounded-3xl p-6 text-center"
        style={{ background: "linear-gradient(165deg,#0e1e2e,#14324a)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[16px] font-extrabold leading-relaxed tracking-wide text-[#f0e6c8]">
          {feature ?? "この機能"}には
          <br />
          プレミアム会員登録が必要です
        </div>
        <a
          href={detailHref}
          className="mt-5 block w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-[#123] no-underline"
          style={{ background: "linear-gradient(120deg,#f0e6c8,#d4b96a)" }}
        >
          詳しくはコチラ →
        </a>
        <button
          onClick={login}
          className="mt-2.5 w-full rounded-2xl border border-white/20 py-2.5 text-[12px] font-bold text-[#c8d8e4]"
        >
          すでに会員の方は Googleでログイン
        </button>
        <button onClick={onClose} className="mt-2 text-[11px] text-[#5a7a92]">
          閉じる
        </button>
      </div>
    </div>,
    document.body
  );
}
