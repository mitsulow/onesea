"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isWarawaUntil } from "@/lib/warawa";
import { WarawaBadge } from "@/components/WarawaBadge";

/* eslint-disable @next/next/no-img-element */

/**
 * 名刺モーダル — 人のアイコンを押すと、まず名刺が現れる（旧・楽市楽座の名刺の作り直し）。
 * カバー + 重なるアバター + 名前 + ライフワーク + 📍地域 + SKILL。
 * 「マイページを見る」でその人のページへ。文字はみ出しは truncate / line-clamp / min-w-0 で防止。
 */

interface MeishiProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
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
}

export function MeishiModal({ username, onClose }: { username: string; onClose: () => void }) {
  const router = useRouter();
  const [p, setP] = useState<MeishiProfile | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, status_line, prefecture, city, rice_work, life_work, skills, member_no, created_at, birthday, warawa_until")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => setP((data as MeishiProfile) ?? null));
  }, [username]);

  // 投稿カードの content-visibility 内に閉じ込められないよう body 直下へポータル描画
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 px-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[300px] flex-col overflow-y-auto rounded-xl shadow-2xl"
        style={{
          animation: "meishiIn .22s ease-out",
          background: "url(/meishi-washi.webp) center / 100% 100%, #f6ecd8",
          aspectRatio: "640 / 1119", // 縦長の名刺（和紙台紙の実寸比）
          maxHeight: "82vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes meishiIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}`}</style>

        {p === undefined ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : p === null ? (
          <div className="p-6 text-center text-[13px] text-[#8a7a5a]">この人の名刺は見つかりませんでした</div>
        ) : (
          <>
            {/* 和紙の枠内: 閉じる + アバター（朱線の内側に収める） */}
            <div className="relative px-8 pt-9">
              <button
                onClick={onClose}
                aria-label="閉じる"
                className="absolute right-8 top-8 flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3428]/10 text-[13px] text-[#6a5a40]"
              >
                ×
              </button>
              {p.avatar_url ? (
                <img
                  src={p.avatar_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-[68px] w-[68px] rounded-full border-[3px] border-[#c94d3a]/50 object-cover shadow-sm"
                />
              ) : (
                <div
                  className="flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-[#c94d3a]/50 text-[26px] shadow-sm"
                  style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                >
                  🌿
                </div>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-8 pb-9 pt-2">
              {/* 名前 + @ */}
              <div className="min-w-0">
                <div className="flex items-center gap-1 truncate text-[17px] font-extrabold text-[#3a3428]">
                  {p.display_name ?? "むらびと"}
                  {isWarawaUntil(p.warawa_until) && <WarawaBadge size={15} />}
                </div>
                {isWarawaUntil(p.warawa_until) && p.member_no != null && (
                  <div className="truncate text-[11px] text-[#b0a890]">@Warawer{String(p.member_no).padStart(7, "0")}</div>
                )}
              </div>

              {/* 地球冒険日数（わらわ〜番号は@Warawerでさりげなく） */}
              {p.birthday && (
                <div className="num mt-1.5 text-[10px] font-bold text-[#a09888]">
                  🌏 地球冒険 {(Math.floor((Date.now() - new Date(p.birthday + "T00:00:00+09:00").getTime()) / 86400000) + 1).toLocaleString()}日目
                </div>
              )}

              {/* ひとこと */}
              {p.status_line && (
                <p className="mt-1.5 line-clamp-2 break-words text-[12.5px] font-medium leading-snug text-[#5a5448]">
                  {p.status_line}
                </p>
              )}

              {/* ライフワーク（名刺の主役） */}
              {(p.life_work || p.rice_work) && (
                <div className="mt-2 min-w-0">
                  {p.life_work && (
                    <div className="line-clamp-2 break-words text-[14px] font-extrabold leading-snug" style={{ color: "#c94d3a" }}>
                      <img src="/icons/icon-heart.webp" alt="" style={{ width: 13, height: 13, display: "inline", verticalAlign: -2.5 }} /> {p.life_work}
                    </div>
                  )}
                  {p.rice_work && (
                    <div className="mt-0.5 line-clamp-1 break-words text-[11.5px] text-[#8a8070]">
                      🍚 {p.rice_work}
                    </div>
                  )}
                </div>
              )}

              {/* 地域 */}
              {(p.prefecture || p.city) && (
                <div className="mt-1.5 truncate text-[11.5px] text-[#8a8070]">
                  <img src="/icons/icon-pin.webp" alt="" style={{ width: 12, height: 12, display: "inline", verticalAlign: -2 }} /> {p.prefecture ?? ""}
                  {p.city ? ` ${p.city}` : ""}
                </div>
              )}

              {/* SKILL チップ（最大4つ・折り返し） */}
              {p.skills && p.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="max-w-full truncate rounded-full bg-[#f0e6d2] px-2.5 py-1 text-[10.5px] font-bold text-[#8a6a20]"
                    >
                      {s}
                    </span>
                  ))}
                  {p.skills.length > 4 && (
                    <span className="rounded-full px-1 py-1 text-[10.5px] text-[#b0a890]">+{p.skills.length - 4}</span>
                  )}
                </div>
              )}

              {/* マイページへ（縦長カードの下端・朱線の内側） */}
              {p.username && (
                <button
                  onClick={() => {
                    onClose();
                    router.push(`/u/${p.username}`);
                  }}
                  className="mt-auto w-full rounded-xl py-2.5 pt-2.5 text-[13.5px] font-extrabold text-white shadow-sm"
                  style={{ background: "#c94d3a", marginTop: "auto" }}
                >
                  マイページを見る →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
