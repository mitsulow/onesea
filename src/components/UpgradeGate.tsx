"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 無料アプリOneSea → わらわ〜会員へのグレードアップ案内。
 * 無料でできること: 手帳 / シューマン共振の現在値 / 各フィードとMMM地球儀の閲覧 / 音の15秒プレビュー。
 * それ以上（投稿・出品・フル再生など）はこのダイアログを出す。
 */
export function UpgradeDialog({ open, onClose, feature }: { open: boolean; onClose: () => void; feature?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
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
        <div className="text-[36px]">🌊</div>
        <div className="mt-1 text-[16px] font-extrabold tracking-wide text-[#f0e6c8]">
          {feature ?? "この機能"}は<br />わらわ〜会員専用です
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[#b8ccda]">
          無料アプリOneSeaでは、手帳・シューマン共振・
          みんなの投稿の閲覧が使えます。
          その先の海へは、わらわ〜会員で。
        </p>
        <a
          href="/join"
          className="mt-4 block w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-[#123] no-underline"
          style={{ background: "linear-gradient(120deg,#f0e6c8,#d4b96a)" }}
        >
          わらわ〜会員へグレードアップはコチラ
        </a>
        <button onClick={login} className="mt-2.5 w-full rounded-2xl border border-white/20 py-2.5 text-[12px] font-bold text-[#c8d8e4]">
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
