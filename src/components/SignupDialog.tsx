"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ensureAuthAlive } from "@/components/ServiceStatus";

/**
 * ゲスト（未ログイン）が無料会員機能（手帳の書き込み等）に触れたときの案内。
 * プレミアム誘導の UpgradeDialog とは別物 — こちらは無料登録（Google認証）へ。
 */
export function SignupDialog({
  open,
  onClose,
  feature,
}: {
  open: boolean;
  onClose: () => void;
  feature?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

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
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-[340px] rounded-3xl p-6 text-center"
        style={{ background: "linear-gradient(165deg,#0e1e2e,#14324a)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15.5px] font-extrabold leading-relaxed tracking-wide text-[#f0e6c8]">
          OneSea会員（無料）になると
          <br />
          {feature ?? "この機能が使えるように"}なります
        </div>
        <button
          onClick={login}
          className="mt-5 w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-white"
          style={{ background: "linear-gradient(120deg,#2CB7DE,#1B8FB5)" }}
        >
          OneSeaに登録（無料）
        </button>
        <button onClick={onClose} className="mt-2.5 text-[11px] text-[#5a7a92]">
          閉じる
        </button>
      </div>
    </div>,
    document.body
  );
}
