"use client";

import { useEffect, useRef, useState } from "react";
import { PREF_COORDS } from "@/lib/sekai";
import type { Village } from "@/lib/sekai";
import { fetchRecoShops, recoCat } from "@/lib/recoShops";

/**
 * 村の地図 — 拠点 + 村人おすすめ（旅先でも美味しい自然なお店）。
 * 地図は検索ではなく「旅先でも血のつながらない家族を見つける装置」。
 * おすすめデータは楽市楽座の recommended_shops（気象庁ならぬ村人の実勧め113件）を共通利用。
 */

const RAKUICHI_SUPA = "https://upfoawnqjfprepanepqj.supabase.co/rest/v1";
const RAKUICHI_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwZm9hd25xamZwcmVwYW5lcHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzU5NTksImV4cCI6MjA5MjI1MTk1OX0.X8sCtshUgyajijFDNIAVipI2ISnJ4eAX5PGw_sSGZtk";

const CAT_COLOR: Record<string, string> = {
  natural_food: "#5a7d4a",
  natural_therapy: "#8a5aa0",
  natural_goods: "#c08030",
  natural_stay: "#3070b0",
  natural_learn: "#c94d3a",
};
const FILTERS = [
  ["all", "すべて"],
  ["base", "拠点"],
  // 村人の「私のおススメの店」（マイページから集計・4セグメント）
  ["reco_alt_med", "🌿 代替医療"],
  ["reco_natural_restaurant", "🍽 ナチュラルなレストラン"],
  ["reco_natural_food", "🌾 自然食品"],
  ["reco_massage", "💆 マッサージ・鍼灸"],
  // 旧・村人おすすめ（楽市楽座の113件）
  ["natural_food", "🌾 たべもの"],
  ["natural_therapy", "💆 いやし"],
  ["natural_goods", "🧺 もの"],
  ["natural_stay", "🏡 とまる"],
  ["natural_learn", "📚 まなぶ"],
] as const;

export function SekaiMap({ villages }: { villages: Village[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState<string>("読み込み中...");
  const [filter, setFilter] = useState<string>("all");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layersRef = useRef<Array<{ cat: string; mk: any }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, { scrollWheelZoom: false }).setView([36.2, 137.5], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      // 拠点マーカー（都道府県の代表点に⛺）
      for (const v of villages) {
        const c = PREF_COORDS[v.prefecture];
        if (!c) continue;
        const jitter = () => (Math.random() - 0.5) * 0.15;
        const mk = L.marker([c[0] + jitter(), c[1] + jitter()], {
          icon: L.divIcon({
            className: "",
            html: `<div style="font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">⛺</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        })
          .addTo(map)
          .bindPopup(
            `<b>${v.name}</b><br>${v.prefecture} ・ ${v.village_members?.[0]?.count ?? 0}人<br><span style="color:#888">${
              v.description ?? ""
            }</span>`
          );
        layersRef.current.push({ cat: "base", mk });
      }

      // 村人おすすめ（自然なお店）
      try {
        const res = await fetch(
          `${RAKUICHI_SUPA}/recommended_shops?select=name,latitude,longitude,category,prefecture,city,description&limit=500`,
          { headers: { apikey: RAKUICHI_ANON, Authorization: `Bearer ${RAKUICHI_ANON}` } }
        );
        const rows = await res.json();
        if (disposed) return;
        let n = 0;
        for (const s of rows ?? []) {
          if (s.latitude == null || s.longitude == null) continue;
          n++;
          const mk = L.circleMarker([s.latitude, s.longitude], {
            radius: 7,
            color: "#ffffff",
            weight: 1.5,
            fillColor: CAT_COLOR[s.category] ?? "#4a8a5c",
            fillOpacity: 0.9,
          })
            .addTo(map)
            .bindPopup(
              `<b>${s.name ?? ""}</b><br>${(s.prefecture ?? "") + (s.city ? " " + s.city : "")}${
                s.description ? `<br><span style="color:#888">${s.description}</span>` : ""
              }`
            );
          layersRef.current.push({ cat: s.category ?? "other", mk });
        }
        setCount(`拠点 ${villages.length} ・ おすすめ ${n}件`);
      } catch {
        setCount(`拠点 ${villages.length}`);
      }

      // 村人みんなの「私のおススメの店」（マイページの地図から集計）
      try {
        const shops = await fetchRecoShops();
        if (disposed) return;
        for (const s of shops) {
          const c = recoCat(s.category);
          const mk = L.marker([s.lat, s.lng], {
            icon: L.divIcon({
              className: "",
              html: `<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${c.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:10px">${c.emoji}</span></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 20],
            }),
          })
            .addTo(map)
            .bindPopup(
              `<b>${s.name}</b><br>${c.emoji} ${c.label}${s.comment ? `<br><span style="color:#888">${s.comment}</span>` : ""}`
            );
          layersRef.current.push({ cat: `reco_${s.category}`, mk });
        }
      } catch {}
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = (f: string) => {
    setFilter(f);
    const map = mapRef.current;
    if (!map) return;
    let n = 0;
    for (const o of layersRef.current) {
      const show = f === "all" || o.cat === f;
      if (show) {
        o.mk.addTo(map);
        n++;
      } else map.removeLayer(o.mk);
    }
    setCount(f === "all" ? `全 ${n}件` : `${n}件を表示中`);
  };

  return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div className="hide-scrollbar -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => applyFilter(id)}
            className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={
              filter === id
                ? { background: "#4a8a5c", color: "#fff", borderColor: "#4a8a5c" }
                : { background: "#fff", color: "#3a7a4c", borderColor: "#d8e4da" }
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div ref={hostRef} style={{ height: 400, borderRadius: 14, zIndex: 1 }} />
      <p className="pt-2 text-center text-[11px] text-[#8a968a]">{count}</p>
    </div>
  );
}
