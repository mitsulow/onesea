"use client";

import { useEffect, useState } from "react";
import {
  RecoShop,
  RECO_CATS,
  recoCat,
  fetchRecoShops,
  addRecoShop,
  deleteRecoShop,
  geocode,
  GeoCandidate,
} from "@/lib/recoShops";
import { DragScroll } from "@/components/DragScroll";

/**
 * 「◯◯さんのおススメの店」— トレーディングカード式（右スワイプでズラリ）。
 * 登録は死ぬほど簡単に:
 *   ① Googleマップで店を開く → 共有 → リンクをコピー → ここに貼る → 自動でカード完成
 *   ② それが無理でも「店名+市町村」検索 → 候補タップの3手
 * ここで登録した店は、セカイムラ地図の「おススメの店」レイヤーにも載る。
 */
export function MyRecoMap({ userId, isMe, ownerName, mode = "shop" }: { userId: string; isMe: boolean; ownerName?: string; mode?: "shop" | "power" }) {
  const isPower = mode === "power";
  const [shops, setShops] = useState<RecoShop[] | null>(null);
  const [cat, setCat] = useState<string>(isPower ? "power_spot" : RECO_CATS[0].id);
  const [paste, setPaste] = useState("");
  const [resolving, setResolving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [cands, setCands] = useState<GeoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    fetchRecoShops(userId).then((list) =>
      setShops(list.filter((x) => (isPower ? x.category === "power_spot" : x.category !== "power_spot")))
    );
  }, [userId, isPower]);

  /* ① Googleマップ共有リンクを貼るだけ登録 */
  const resolveLink = async (raw: string) => {
    const url = raw.trim();
    if (!url || resolving) return;
    if (!/^https?:\/\//.test(url)) return;
    setResolving(true);
    setMsg(null);
    try {
      const r = await fetch("/api/reco/resolve?url=" + encodeURIComponent(url));
      const d = await r.json();
      if (!r.ok || (!d.name && d.lat == null)) {
        setMsg("リンクを読めませんでした。Googleマップの「共有→リンクをコピー」の形で貼ってください");
      } else {
        const created = await addRecoShop(userId, {
          name: (d.name as string) || (isPower ? "パワースポット" : "お店"),
          category: cat,
          lat: (d.lat as number) ?? 35.68,
          lng: (d.lng as number) ?? 139.76,
          address: null,
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

  /* ② 店名検索フォールバック */
  const search = async () => {
    if (!q.trim() || searching) return;
    setSearching(true);
    setCands(null);
    const list = await geocode(q.trim());
    setSearching(false);
    setCands(list);
  };
  const pick = async (cand: GeoCandidate) => {
    if (saving) return;
    setSaving(true);
    const created = await addRecoShop(userId, {
      name: q.trim(),
      category: cat,
      lat: cand.lat,
      lng: cand.lng,
      address: cand.label,
    });
    setSaving(false);
    if (created) {
      setShops((prev) => [created, ...(prev ?? [])]);
      setQ("");
      setCands(null);
    }
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
          {/* カテゴリ（パワースポットは1種なので非表示） */}
          <div className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto" style={isPower ? { display: "none" } : undefined}>
            {RECO_CATS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={
                  cat === c.id
                    ? { background: c.color, color: "#fff", borderColor: c.color }
                    : { background: "#fff", color: "#8a8070", borderColor: "#e8dcc4" }
                }
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          {/* Googleマップのリンクを貼るだけ */}
          <input
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              // 貼り付けた瞬間に自動で解決（ボタン押し不要）
              if (/^https?:\/\//.test(e.target.value.trim())) resolveLink(e.target.value);
            }}
            placeholder="Googleマップの共有リンクを貼るだけ（共有→リンクをコピー）"
            className="w-full rounded-xl border border-[#2CB7DE55] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#2CB7DE]"
          />
          {resolving && <p className="mt-1 text-[11px] text-[#2CB7DE]">カードを作っています…</p>}
          {msg && <p className="mt-1 text-[11px] text-[#8a7a5a]">{msg}</p>}
          {/* フォールバック: 店名で探す */}
          <button onClick={() => setManualOpen((v) => !v)} className="mt-1.5 text-[11px] font-bold text-[#a09888]">
            {manualOpen ? "▾" : "▸"} リンクが無い時は店名で探す
          </button>
          {manualOpen && (
            <div className="mt-1.5">
              <div className="flex gap-1.5">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) search();
                  }}
                  placeholder="店名 + 市町村（例: 浮島ガーデン 那覇）"
                  className="min-w-0 flex-1 rounded-xl border border-[#e8dcc4] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#c94d3a]"
                />
                <button
                  onClick={search}
                  disabled={!q.trim() || searching}
                  className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40"
                  style={{ background: "#2CB7DE" }}
                >
                  {searching ? "検索中" : "探す"}
                </button>
              </div>
              {cands !== null &&
                (cands.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-[#a09888]">見つかりませんでした。「店名 市町村」の形でもう一度どうぞ</p>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    {cands.map((cd, i) => (
                      <button
                        key={i}
                        onClick={() => pick(cd)}
                        disabled={saving}
                        className="block w-full rounded-lg border border-[#e8dcc4] bg-white px-2.5 py-1.5 text-left text-[11.5px] leading-snug text-[#5a5448] disabled:opacity-50"
                      >
                        {cd.label}
                      </button>
                    ))}
                  </div>
                ))}
            </div>
          )}
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
                className="relative w-[128px] flex-shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm"
                style={{ borderColor: c.color + "66" }}
              >
                <div className="flex items-center gap-1 px-2 py-1 text-[9.5px] font-extrabold text-white" style={{ background: c.color }}>
                  <span>{c.emoji}</span>
                  <span className="truncate">{c.label}</span>
                </div>
                <div className="flex h-[74px] flex-col justify-between p-2">
                  <div className="line-clamp-3 text-[12px] font-extrabold leading-snug text-[#3a3428]">{s.name}</div>
                  {s.comment && <div className="truncate text-[9.5px] text-[#a09888]">{s.comment}</div>}
                </div>
                {isMe && (
                  <button
                    onClick={() => remove(s)}
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
