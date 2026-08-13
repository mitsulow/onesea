"use client";

import { srcCdn } from "@/lib/images";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isWarawaUntil, SIR_USER_ID } from "@/lib/warawa";
import { WarawaBadge } from "@/components/WarawaBadge";
import { sendFriendRequest } from "@/lib/friends";

/* eslint-disable @next/next/no-img-element */

/**
 * 名刺モーダル 2026-08-13版 — 透いた白和紙（耳付き・周囲ほころび）の台紙に、
 * 細い枠線で囲み、枠線上のトップに小さく「名 刺」。
 * バッジ: わらわ〜=「わらわ〜プレミアムNo.36」/ 無料会員=「無料わんし〜会員」/
 *         みつろうだけ「Warawa-Sir」（黒縁）。セカイムラは「セカイムラ沖縄村人」表記。
 */

interface MeishiProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status_line: string | null;
  prefecture: string | null;
  city: string | null;
  rice_work: string | null;
  life_work: string | null;
  skills: string[] | null;
  member_no: number | null;
  warawa_until: string | null;
  created_at: string | null;
  birthday: string | null;
  murabito: boolean | null;
}

export function MeishiModal({ username, onClose }: { username: string; onClose: () => void }) {
  const router = useRouter();
  const [p, setP] = useState<MeishiProfile | null | undefined>(undefined);
  const [meId, setMeId] = useState<string | null>(null);
  const [exchanged, setExchanged] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMeId(session?.user?.id ?? null));
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, status_line, prefecture, city, rice_work, life_work, skills, member_no, created_at, birthday, warawa_until, murabito")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => setP((data as MeishiProfile) ?? null));
  }, [username]);

  // オンライン名刺交換(→ともだち申請が相手のTALKに届く)。QRと同じRPCを使う
  const exchangeOnline = async () => {
    if (!meId || !p || exchanged !== "idle") return;
    setExchanged("busy");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("meishi_exchange", { p_other: p.id });
    if (!error && data === "ok") {
      try { await sendFriendRequest(meId, p.id); } catch { /* noop */ }
      setExchanged("done");
    } else {
      setExchanged("idle");
    }
  };

  if (typeof document === "undefined") return null;

  const isSir = p?.id === SIR_USER_ID;
  const isWara = p ? isWarawaUntil(p.warawa_until) : false;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-5" onClick={onClose}>
      <div
        className="relative w-full max-w-[310px]"
        style={{ animation: "meishiIn .22s ease-out", maxHeight: "84vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes meishiIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}`}</style>

        {/* 透いた白和紙の台紙（周囲ほころび・透過PNG） */}
        <img src="/meishi-washi-white.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full" style={{ objectFit: "fill" }} />

        {/* 和紙の内側: 細い枠線（余白を空けて）。枠線上トップに「名 刺」。
            ※「名 刺」はスクロール枠の外側に置く（overflow内に入れると枠の上の文字が切れて消えるバグがあった） */}
        <div className="relative m-[26px]" style={{ maxHeight: "calc(84vh - 52px)" }}>
          <span
            className="absolute -top-[8px] left-1/2 z-10 -translate-x-1/2 px-2 text-[10px] font-bold tracking-[6px] text-[#8a7f66]"
            style={{ background: "#f7f4ec" }}
          >
            名 刺
          </span>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-[13px] text-[#8a7f66]"
          >
            ×
          </button>
          <div className="flex flex-col overflow-y-auto border border-[#b8ae96] px-4 pb-4 pt-5" style={{ maxHeight: "calc(84vh - 52px)", minHeight: 420 }}>

          {p === undefined ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
            </div>
          ) : p === null ? (
            <div className="p-4 text-center text-[13px] text-[#8a7a5a]">この人の名刺は見つかりませんでした</div>
          ) : (
            <>
              {/* アバター（中央） */}
              <div className="flex justify-center pt-1.5">
                {p.avatar_url ? (
                  <img
                    src={srcCdn(p.avatar_url)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-[74px] w-[74px] rounded-full border-2 border-[#c9bc9c] object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-2 border-[#c9bc9c]" style={{ background: "linear-gradient(140deg,#e8efe0,#cfe0c8)" }}>
                    <img src="/icons/icon-leaf.webp" alt="" style={{ width: 18, height: 18 }} />
                  </div>
                )}
              </div>

              {/* 名前 */}
              <div className="mt-2 flex items-center justify-center gap-1 text-center text-[17px] font-extrabold leading-snug text-[#3a3428]">
                <span className="min-w-0 truncate">{p.display_name ?? "むらびと"}</span>
                {isWara && <WarawaBadge size={15} sir={isSir} />}
              </div>

              {/* 称号バッジ列 */}
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                {isSir ? (
                  <span className="rounded-full border-2 border-[#141414] bg-[#faf6ea] px-2.5 py-0.5 text-[10.5px] font-extrabold tracking-[1px] text-[#141414]">
                    Warawa-Sir
                  </span>
                ) : isWara && p.member_no != null ? (
                  <span className="rounded-full border border-[#c9a94a] bg-[#faf3dd] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#8a6a20]">
                    わらわ〜プレミアムNo.{p.member_no}
                  </span>
                ) : isWara ? (
                  <span className="rounded-full border border-[#c9a94a] bg-[#faf3dd] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#8a6a20]">
                    わらわ〜プレミアム会員
                  </span>
                ) : (
                  <span className="rounded-full border border-[#b8c6d6] bg-[#eef4f8] px-2.5 py-0.5 text-[10.5px] font-bold text-[#5a7a94]">
                    無料わんし〜会員
                  </span>
                )}
                {p.murabito && p.prefecture && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-[#1e5c34]"
                    style={{ background: "linear-gradient(135deg,#eef8ee,#cfe8d2)", border: "1px solid #a8d0b0" }}
                  >
                    セカイムラ{p.prefecture.replace(/[都府県]$/, "")}の村人
                  </span>
                )}
              </div>

              {/* 地球冒険日数 */}
              {p.birthday && (
                <div className="num mt-2 text-center text-[10.5px] font-bold text-[#a09888]">
                  <img src="/icons/cel-earth.png" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> 地球冒険 {(Math.floor((Date.now() - new Date(p.birthday + "T00:00:00+09:00").getTime()) / 86400000) + 1).toLocaleString()}日目
                </div>
              )}

              {/* ひとこと */}
              {p.status_line && (
                <p className="mt-2 line-clamp-2 break-words text-center text-[12.5px] font-medium leading-snug text-[#5a5448]">
                  {p.status_line}
                </p>
              )}

              {/* ライフワーク（名刺の主役） */}
              {p.life_work && (
                <div className="mt-2.5 border-t border-dashed border-[#d8cfb8] pt-2 text-center">
                  <div className="text-[8.5px] font-bold tracking-[3px] text-[#a09372]">LIFE WORK</div>
                  <div className="mt-0.5 line-clamp-2 break-words text-[13.5px] font-extrabold leading-snug" style={{ color: "#c94d3a" }}>
                    {p.life_work}
                  </div>
                </div>
              )}
              {p.rice_work && (
                <div className="mt-1 line-clamp-1 break-words text-center text-[11px] text-[#8a8070]">
                  <img src="/icons/icon-rice-bowl.webp" alt="" style={{ width: 12, height: 12, display: "inline", verticalAlign: -2 }} /> {p.rice_work}
                </div>
              )}

              {/* 地域 */}
              {(p.prefecture || p.city) && (
                <div className="mt-1.5 truncate text-center text-[11px] text-[#8a8070]">
                  <img src="/icons/icon-pin.webp" alt="" style={{ width: 11, height: 11, display: "inline", verticalAlign: -1.5 }} /> {p.prefecture ?? ""}
                  {p.city ? ` ${p.city}` : ""}
                </div>
              )}

              {/* SKILL */}
              {p.skills && p.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                  {p.skills.slice(0, 4).map((s) => (
                    <span key={s} className="max-w-full truncate rounded-full bg-[#efe8d4] px-2.5 py-1 text-[10px] font-bold text-[#8a6a20]">
                      {s}
                    </span>
                  ))}
                  {p.skills.length > 4 && <span className="px-1 py-1 text-[10px] text-[#b0a890]">+{p.skills.length - 4}</span>}
                </div>
              )}

              {/* オンライン名刺交換 → ともだち申請 */}
              {meId && meId !== p.id && (
                <button
                  onClick={exchangeOnline}
                  disabled={exchanged !== "idle"}
                  className="w-full rounded-lg py-2 text-[12.5px] font-extrabold text-white disabled:opacity-70"
                  style={{ marginTop: "14px", background: exchanged === "done" ? "#2a8a4a" : "#8a6a20" }}
                >
                  {exchanged === "done" ? "✅ 名刺交換＆ともだち申請を送りました" : exchanged === "busy" ? "交換中..." : "🤝 名刺交換して ともだち申請"}
                </button>
              )}

              {/* マイページへ。名刺から飛んだ時はマイページ側の「まず名刺」自動表示をスキップ
                  (名刺→マイページ→また名刺 の二重表示バグ対策) */}
              {p.username && (
                <button
                  onClick={() => {
                    try { sessionStorage.setItem("meishi-skip-once", p.username!); } catch { /* noop */ }
                    onClose();
                    router.push(`/u/${p.username}`);
                  }}
                  className="mt-auto w-full rounded-lg border border-[#c94d3a] py-2 text-[12.5px] font-extrabold text-[#c94d3a]"
                  style={{ marginTop: meId && meId !== p.id ? "8px" : "14px", background: "rgba(201,77,58,.05)" }}
                >
                  マイページを見る →
                </button>
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
