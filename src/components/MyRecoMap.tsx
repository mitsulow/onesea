"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * マイページの「私のおススメの店」地図。
 * 入力は3手: ①カテゴリをタップ ②店名（+市町村）を打つ ③候補をタップ → 即ピン。
 * 見に来た人には「◯◯さんはこんな店が好きなんだ」が地図で伝わる。
 */
export function MyRecoMap({ userId, isMe }: { userId: string; isMe: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  const [shops, setShops] = useState<RecoShop[] | null>(null);
  const [cat, setCat] = useState<string>(RECO_CATS[0].id);
  const [q, setQ] = useState("");
  const [cands, setCands] = useState<GeoCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    fetchRecoShops(userId).then(setShops);
  }, [userId]);

  /* 地図の初期化とピンの同期 */
  useEffect(() => {
    if (shops === null) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !hostRef.current) return;
      if (!mapRef.current) {
        const map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([36.2, 137.5], 4.5);
        mapRef.current = map;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 18,
        }).addTo(map);
      }
      const map = mapRef.current;
      // 消えた分を除去、新しい分を追加
      const ids = new Set(shops.map((s) => s.id));
      for (const [id, mk] of markersRef.current) {
        if (!ids.has(id)) {
          map.removeLayer(mk);
          markersRef.current.delete(id);
        }
      }
      for (const s of shops) {
        if (markersRef.current.has(s.id)) continue;
        const c = recoCat(s.category);
        const mk = L.marker([s.lat, s.lng], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:11px">${c.emoji}</span></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
          }),
        })
          .addTo(map)
          .bindPopup(`<b>${s.name}</b><br>${c.emoji} ${c.label}${s.comment ? `<br><span style="color:#888">${s.comment}</span>` : ""}`);
        markersRef.current.set(s.id, mk);
      }
      // ピンが1つ以上あれば全部が入る画角に
      if (shops.length > 0) {
        const b = L.latLngBounds(shops.map((s) => [s.lat, s.lng] as [number, number]));
        map.fitBounds(b.pad(0.35), { maxZoom: 11 });
      }
    })();
    return () => {
      disposed = true;
    };
  }, [shops]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

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

  if (shops !== null && shops.length === 0 && !isMe) return null; // 他人のページでピン0なら出さない

  return (
    <section className="mt-3">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-[13.5px] font-extrabold tracking-wide text-[#3a3428]">📍 私のおススメの店</h2>
        {shops && shops.length > 0 && <span className="num text-[10.5px] text-[#a09888]">{shops.length}軒</span>}
      </div>

      {isMe && (
        <div className="mb-2 rounded-xl border border-[#ede5d8] bg-[#fffaf0] p-2.5">
          {/* ① カテゴリ */}
          <div className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
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
          {/* ② 店名 → ③ 候補タップで即ピン */}
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
              {searching ? "検索中" : "地図で探す"}
            </button>
          </div>
          {cands !== null &&
            (cands.length === 0 ? (
              <p className="mt-1.5 text-[11px] text-[#a09888]">
                見つかりませんでした。「店名 市町村」の形でもう一度どうぞ
              </p>
            ) : (
              <div className="mt-1.5 space-y-1">
                {cands.map((cd, i) => (
                  <button
                    key={i}
                    onClick={() => pick(cd)}
                    disabled={saving}
                    className="block w-full rounded-lg border border-[#e8dcc4] bg-white px-2.5 py-1.5 text-left text-[11.5px] leading-snug text-[#5a5448] disabled:opacity-50"
                  >
                    📍 {cd.label}
                  </button>
                ))}
              </div>
            ))}
        </div>
      )}

      <div ref={hostRef} className="h-[230px] w-full overflow-hidden rounded-xl border border-[#ede5d8]" />

      {/* ピン一覧（自分は削除できる） */}
      {shops && shops.length > 0 && (
        <div className="mt-1.5">
          {(listOpen ? shops : shops.slice(0, 3)).map((s) => {
            const c = recoCat(s.category);
            return (
              <div key={s.id} className="flex items-center gap-2 border-b border-[#f2ece0] py-1.5 text-[12px]">
                <span style={{ color: c.color }}>{c.emoji}</span>
                <span className="min-w-0 flex-1 truncate font-bold text-[#3a3428]">{s.name}</span>
                <span className="flex-shrink-0 text-[10px] text-[#a09888]">{c.label}</span>
                {isMe && (
                  <button onClick={() => remove(s)} className="flex-shrink-0 px-1 text-[11px] text-[#b0a890]" aria-label="削除">
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {shops.length > 3 && (
            <button onClick={() => setListOpen((v) => !v)} className="mt-1 text-[11px] font-bold text-[#2CB7DE]">
              {listOpen ? "たたむ" : `すべて見る（${shops.length}軒）`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
