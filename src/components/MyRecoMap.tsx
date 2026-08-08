"use client";

import { useEffect, useState } from "react";
import {
  RecoShop,
  RECO_CATS,
  recoCat,
  fetchRecoShops,
  addRecoShop,
  deleteRecoShop,
} from "@/lib/recoShops";
import { DragScroll } from "@/components/DragScroll";

/**
 * 「◯◯さんのおススメの店」— トレーディングカード式（右スワイプでズラリ）。
 * 登録は死ぬほど簡単に:
 *   Googleマップ/Google検索で店を開く → 共有（またはリンクをコピー） → ここに貼る → 自動でカード完成
 *   共有文に店名が混ざっていてもOK。名前・位置・写真1枚を自動取得する。
 * ここで登録した店は、セカイムラ地図の「おススメの店」レイヤーにも載る。
 */
export function MyRecoMap({ userId, isMe, ownerName, mode = "shop" }: { userId: string; isMe: boolean; ownerName?: string; mode?: "shop" | "power" }) {
  const isPower = mode === "power";
  const [shops, setShops] = useState<RecoShop[] | null>(null);
  const [cat, setCat] = useState<string>(isPower ? "power_spot" : RECO_CATS[0].id);
  const [paste, setPaste] = useState("");
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchRecoShops(userId).then((list) =>
      setShops(list.filter((x) => (isPower ? x.category === "power_spot" : x.category !== "power_spot")))
    );
  }, [userId, isPower]);

  /* Google共有（マップ/検索）を貼るだけ登録。共有テキストに店名が混ざっていてもOK */
  const resolveLink = async (raw: string) => {
    if (resolving) return;
    const text = raw.trim();
    const mUrl = text.match(/https?:\/\/[^\s]+/);
    if (!mUrl) return;
    const url = mUrl[0];
    // URL以外の部分（店名などの共有文）はヒントとしてサーバーへ
    const hint = text.replace(url, "").replace(/[\n\r"']+/g, " ").trim().slice(0, 100);
    setResolving(true);
    setMsg(null);
    try {
      const r = await fetch(
        "/api/reco/resolve?url=" + encodeURIComponent(url) + (hint ? "&hint=" + encodeURIComponent(hint) : "")
      );
      const d = await r.json();
      if (!r.ok || (!d.name && d.lat == null)) {
        setMsg("リンクを読めませんでした。Googleマップ/Google検索の共有ボタンからコピーしたものを貼ってください");
      } else {
        const created = await addRecoShop(userId, {
          name: (d.name as string) || hint || (isPower ? "パワースポット" : "お店"),
          category: cat,
          lat: (d.lat as number) ?? 35.68,
          lng: (d.lng as number) ?? 139.76,
          address: null,
          image_url: (d.image as string) ?? null,
        });
        if (created) {
          setShops((prev) => [created, ...(prev ?? [])]);
          setPaste("");
          setMsg("カードを作りました ✨");
          setTimeout(() => setMsg(null), 2500);
        }
      }
    } catch {
      setMsg("通信に失敗しました");
    }
    setResolving(false);
  };

  const remove = async (s: RecoShop) => {
    await deleteRecoShop(s.id, userId);
    setShops((prev) => (prev ?? []).filter((x) => x.id !== s.id));
  };

  if (shops !== null && shops.length === 0 && !isMe) return null;

  const title = `${ownerName ?? "この人"}さんのおススメの${isPower ? "パワースポット" : "お店"}`;

  return (
    <section className="mt-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-[13.5px] font-extrabold tracking-wide text-[#3a3428]">
          <img src="/icons/icon-pin.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -2.5 }} /> {title}
        </h2>
        {shops && shops.length > 0 && <span className="num text-[10.5px] text-[#a09888]">{shops.length}{isPower ? "ヶ所" : "軒"}</span>}
      </div>

      {isMe && (
        <div className="mb-2 rounded-xl border border-[#ede5d8] bg-[#fffaf0] p-2.5">
          {/* ① ジャンルをリストから選ぶ（押し間違い防止のためタブではなくセレクト） */}
          {!isPower && (
            <div className="mb-2">
              <div className="mb-1 text-[11px] font-extrabold text-[#8a7a5a]">① ジャンルを選択</div>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
                className="w-full rounded-xl border-2 bg-white px-3 py-2.5 text-[13.5px] font-bold outline-none"
                style={{ borderColor: recoCat(cat).color, color: recoCat(cat).color }}
              >
                {RECO_CATS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!isPower && <div className="mb-1 text-[11px] font-extrabold text-[#8a7a5a]">② Googleマップなどで「共有 → リンクをコピー」して貼る</div>}
          {/* Googleマップのリンクを貼るだけ */}
          <input
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              // 貼り付けた瞬間に自動で解決（ボタン押し不要）。共有文に店名が混ざっていてもOK
              if (/https?:\/\//.test(e.target.value)) resolveLink(e.target.value);
            }}
            placeholder="GoogleマップかGoogle検索の「共有」からコピーして、ここに貼るだけ"
            className="w-full rounded-xl border border-[#2CB7DE55] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#2CB7DE]"
          />
          {resolving && <p className="mt-1 text-[11px] text-[#2CB7DE]">カードを作っています…</p>}
          {msg && <p className="mt-1 text-[11px] text-[#8a7a5a]">{msg}</p>}
        </div>
      )}

      {/* トレーディングカード（右スワイプでズラリ） */}
      {shops && shops.length > 0 && (
        <DragScroll className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {shops.map((s) => {
            const c = recoCat(s.category);
            return (
              <div
                key={s.id}
                onClick={() => { window.location.href = "/sekai/map?shop=" + s.id; }}
                className="relative w-[128px] flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border bg-white shadow-sm"
                style={{ borderColor: c.color + "66" }}
              >
                <div className="flex items-center gap-1 px-2 py-1 text-[9.5px] font-extrabold text-white" style={{ background: c.color }}>
                  <span>{c.emoji}</span>
                  <span className="truncate">{c.label}</span>
                </div>
                {s.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[64px] w-full object-cover" />
                )}
                <div className="flex h-[74px] flex-col justify-between p-2">
                  <div className="line-clamp-3 text-[12px] font-extrabold leading-snug text-[#3a3428]">{s.name}</div>
                  {s.comment && <div className="truncate text-[9.5px] text-[#a09888]">{s.comment}</div>}
                </div>
                {isMe && (
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(s); }}
                    className="absolute right-1 top-[26px] flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[11px] text-[#8a8070]"
                    aria-label="削除"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </DragScroll>
      )}
      {isMe && shops && shops.length === 0 && (
        <p className="py-2 text-center text-[11.5px] text-[#b0a890]">好きなお店を登録すると、ここにカードが並びます</p>
      )}
    </section>
  );
}
