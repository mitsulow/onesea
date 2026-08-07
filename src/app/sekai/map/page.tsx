"use client";

import { useEffect, useState } from "react";
import { SekaiShell, SectionTitle, MapLoader } from "@/components/sekai/sections";
import { createClient } from "@/lib/supabase/client";
import { recoCat } from "@/lib/recoShops";

/** セカイムラ地図 + みんなのおススメの店（現在地10km / 県で絞り込み） */
export default function SekaiMapPage() {
  return (
    <SekaiShell>
      <section className="card">
        <SectionTitle><img src="/icons/icon-japanmap.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3 }} /> セカイムラ地図 — 旅先でも家族を見つける</SectionTitle>
        <MapLoader />
        <RecoFinder />
      </section>
    </SekaiShell>
  );
}

type RecoRow = { id: string; name: string; category: string; comment: string | null; lat: number; lng: number; address: string | null };

/**
 * みんなのおススメの店ファインダー。
 * 25,000人x10軒でもパケ死しない設計: 全件は絶対に取らず、
 * 「現在地10kmの矩形」or「県の代表点±0.7度の矩形」で絞ってから最大120件だけ取得。
 */
function RecoFinder() {
  const [mode, setMode] = useState<"near" | "pref" | null>(null);
  const [pref, setPref] = useState("");
  const [prefs, setPrefs] = useState<string[]>([]);
  const [muni, setMuni] = useState<Record<string, [string, number, number][]> | null>(null);
  const [rows, setRows] = useState<RecoRow[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data-municipalities.json")
      .then((r) => r.json())
      .then((d) => {
        setMuni(d);
        setPrefs(Object.keys(d));
      })
      .catch(() => {});
  }, []);

  const fetchBox = async (lat: number, lng: number, dLat: number, dLng: number) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("reco_shops")
      .select("id, name, category, comment, lat, lng, address")
      .neq("category", "power_spot")
      .gte("lat", lat - dLat)
      .lte("lat", lat + dLat)
      .gte("lng", lng - dLng)
      .lte("lng", lng + dLng)
      .limit(120);
    return (data ?? []) as RecoRow[];
  };

  const searchNear = async () => {
    setMode("near");
    setRows(null);
    setMsg(null);
    const done = (lat: number, lng: number) =>
      fetchBox(lat, lng, 0.09, 0.11).then((list) => {
        const km = (r: RecoRow) => {
          const dx = (r.lng - lng) * 91;
          const dy = (r.lat - lat) * 111;
          return Math.sqrt(dx * dx + dy * dy);
        };
        setRows(list.filter((r) => km(r) <= 10).sort((a, b) => km(a) - km(b)));
      });
    try {
      const saved = JSON.parse(localStorage.getItem("onesea-pos") ?? "null");
      if (saved && typeof saved.lat === "number") { done(saved.lat, saved.lon); return; }
    } catch {}
    navigator.geolocation?.getCurrentPosition(
      (pos) => done(pos.coords.latitude, pos.coords.longitude),
      () => setMsg("現在地を取得できませんでした。県で選んでみてください")
    );
  };

  const searchPref = async (pf: string) => {
    setPref(pf);
    if (!pf || !muni) return;
    setMode("pref");
    setRows(null);
    const first = muni[pf]?.[0];
    if (!first) return;
    setRows(await fetchBox(first[1], first[2], 0.75, 0.85));
  };

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[12px] font-extrabold text-[#2a5a38]">
        <img src="/icons/icon-pin.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> みんなのおススメの店をさがす
      </div>
      <div className="flex gap-2">
        <button
          onClick={searchNear}
          className="flex-1 rounded-xl py-2.5 text-[12px] font-extrabold"
          style={mode === "near" ? { background: "#2a7a48", color: "#fff" } : { background: "#eef6ef", color: "#2a5a38", border: "1px solid #cfe0d2" }}
        >
          現在地から10km以内の店
        </button>
        <select
          value={pref}
          onChange={(e) => searchPref(e.target.value)}
          className="flex-1 rounded-xl border border-[#cfe0d2] bg-white px-2 py-2.5 text-center text-[12px] font-bold text-[#2a5a38] outline-none"
        >
          <option value="">都道府県でさがす ▾</option>
          {prefs.map((pf) => (
            <option key={pf} value={pf}>{pf}</option>
          ))}
        </select>
      </div>
      {msg && <p className="mt-1.5 text-[11px] text-[#c05030]">{msg}</p>}
      {mode && rows === null && !msg && <p className="py-3 text-center text-[11.5px] text-[#8aa898]">さがしています…</p>}
      {rows !== null && (
        <div className="mt-2">
          {rows.length === 0 ? (
            <p className="py-3 text-center text-[11.5px] text-[#8aa898]">この範囲にはまだ登録がありません。あなたのマイページから最初の1軒をどうぞ</p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => {
                const c = recoCat(r.category);
                return (
                  <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[#e4ede4] bg-white px-3 py-2">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[15px]" style={{ background: c.color + "22" }}>
                      {c.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-extrabold text-[#2a3a2c]">{r.name}</div>
                      <div className="truncate text-[10px] text-[#8aa898]">
                        {c.label}
                        {r.comment ? ` ・ ${r.comment}` : ""}
                      </div>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 rounded-full bg-[#eef6ef] px-2.5 py-1 text-[10.5px] font-bold text-[#2a5a38] no-underline"
                    >
                      地図
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
