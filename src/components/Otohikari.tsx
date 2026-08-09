"use client";

import { useEffect, useState } from "react";
import { OtohikariGlobe, MapMode } from "./OtohikariGlobe";
import { SCHUMANN, SCHUMANN_DATA_URL, TARGET_HZ } from "@/lib/config";
import { Cinzel } from "next/font/google";

// MMM本家と同じ数字フォント（Cinzel）
const serif = Cinzel({ subsets: ["latin"], weight: ["700"] });

interface SchumannLive {
  f1hz: number | null;
  updated: string | null;
}

/** [lat, lng, 人数] */
export type Spot = [number, number, number];

const MAP_MODES: Array<{ id: MapMode; name: string; short: string; desc: string }> = [
  { id: "otohikari", name: "OTOHIKARIMAP", short: "OTO", desc: "光の音柱" },
  { id: "thunder", name: "sprite&thunderMAP", short: "INAZUMA", desc: "雷電活動" },
  { id: "all", name: "ALLMAP", short: "ALL", desc: "全てを表示" },
];

/**
 * MasterMindSystem — 地球儀 + 実測シューマン + 点呼集計。
 * - マップモード: 光の音柱のみ / 雷電活動のみ / 全て（プルダウンで選択）
 * - 再生・瞑想などで接続中は「MasterMindに接続しています」を地球儀上に表示
 * - 集計値は南半球の下部に重ねて一体化
 */
export function Otohikari() {
  const [live, setLive] = useState<SchumannLive>({ f1hz: null, updated: null });
  const [nowCount, setNowCount] = useState(0);
  const [faces, setFaces] = useState<Array<{ name: string | null; avatar: string | null; username: string | null }> | null>(null); // Tune-in中の顔ぶれ(タップで表示)
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [mode, setMode] = useState<MapMode>("all");
  const [modeOpen, setModeOpen] = useState(false);
  const [connected, setConnected] = useState(false);

  /* ---- マップモード（端末に記憶） ---- */
  useEffect(() => {
    try {
      const m = localStorage.getItem("onesea-map-mode") as MapMode | null;
      if (m === "otohikari" || m === "thunder" || m === "all") setMode(m);
    } catch {}
  }, []);
  const pickMode = (m: MapMode) => {
    setMode(m);
    setModeOpen(false);
    try {
      localStorage.setItem("onesea-map-mode", m);
    } catch {}
  };

  /* ---- プレイヤーからの接続通知 ---- */
  useEffect(() => {
    const on = (e: Event) => setConnected((e as CustomEvent).detail?.on === true);
    window.addEventListener("onesea:mm", on);
    return () => window.removeEventListener("onesea:mm", on);
  }, []);

  /* ---- シューマン共振 実測データ ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(SCHUMANN_DATA_URL, { cache: "no-store" });
        const d = await res.json();
        if (cancelled) return;
        setLive({ f1hz: d?.modes?.F1?.hz ?? null, updated: d?.timestamp ?? null });
      } catch {}
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  /* ---- 集計スナップショットのポーリング（30秒・エッジキャッシュ） ---- */
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/otohikari");
        const d = await r.json();
        if (stop) return;
        setNowCount(typeof d.now === "number" ? d.now : 0);
        if (typeof d.today === "number") setTodayCount(d.today);
        setSpots(Array.isArray(d.spots) ? (d.spots as Spot[]) : []);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  const current = MAP_MODES.find((m) => m.id === mode)!;

  const stat = (label: string, value: React.ReactNode) => (
    <div>
      <div className="text-[9px] tracking-[3px] text-[#7fa08c]">{label}</div>
      <div
        className={`${serif.className} num text-[21px] font-bold leading-tight text-[#b8f0c8]`}
        style={{ textShadow: "0 0 16px rgba(140,240,170,.65), 0 2px 10px rgba(0,0,0,.65)" }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(160deg,#0a1826,#12283a)",
        border: "none",
        borderRadius: 0,
        margin: "0 -16px 0 -16px",
        padding: 0,
      }}
    >
      {/* タイトル + MAPボタン: 文字1行分の薄い帯（背景は地球儀と同じ色） */}
      <div className="relative z-30 flex items-center justify-between px-3 py-1" style={{ background: "#050a14" }}>
        <span
          className="text-[15px] font-extrabold tracking-[2px]"
          style={{
            color: "#8ff4ff",
            textShadow:
              "0 0 6px rgba(120,235,255,.95), 0 0 14px rgba(80,220,255,.7), 0 0 30px rgba(40,200,255,.5)",
          }}
        >
          <span
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              letterSpacing: "1px",
              color: "#d8a0ff",
              textShadow: "0 0 6px rgba(200,120,255,.95), 0 0 14px rgba(180,80,255,.7), 0 0 30px rgba(160,40,255,.5)",
            }}
          >
            ▽OtOHikari-map
          </span>
        </span>
        <div className="relative">
          <button
            onClick={() => setModeOpen((v) => !v)}
            className="rounded-full border border-[#2a4a5e] bg-[#0c1c2a]/80 px-2.5 py-0.5 text-[9.5px] font-bold tracking-wider text-[#7ab8d8]"
          >
            {current.short} {modeOpen ? "▴" : "▾"}
          </button>
          {modeOpen && (
            <div
              className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-[#2a4a5e] bg-[#0c1c2a]"
              style={{ boxShadow: "0 8px 30px rgba(0,0,0,.5)" }}
            >
              {MAP_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickMode(m.id)}
                  className="flex w-full items-baseline justify-between gap-2 border-b border-[#16283a] px-3 py-2.5 text-left last:border-0"
                  style={{ background: m.id === mode ? "#12283a" : "transparent" }}
                >
                  <span
                    className="text-[11px] font-extrabold tracking-wider"
                    style={{ color: m.id === mode ? "#8ff4ff" : "#7a9ab4" }}
                  >
                    {m.name}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-[#5a7a9a]">{m.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 地球儀 + オーバーレイ */}
      <div className="relative">
        <OtohikariGlobe spots={spots} mode={mode} connected={connected} />

        {/* 実測時刻 — セクションの一番下・右端 */}
        {live.updated && (
          <span className="num pointer-events-none absolute right-3 top-1 z-20 text-[9px] text-[#5a7a9a]">
            実測 {new Date(live.updated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新
          </span>
        )}

        {/* MasterMind接続中 — ヘッドホン + パルス波形 */}
        {connected && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2.5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8ff4ff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(120,235,255,.9))" }}
                aria-hidden
              >
                <path d="M4 14a8 8 0 0 1 16 0" />
                <rect x="3" y="13.5" width="4" height="6.5" rx="1.8" fill="rgba(143,244,255,.18)" />
                <rect x="17" y="13.5" width="4" height="6.5" rx="1.8" fill="rgba(143,244,255,.18)" />
              </svg>
              <span
                className="text-[15px] font-extrabold tracking-[3px]"
                style={{
                  color: "#8ff4ff",
                  textShadow:
                    "0 0 10px rgba(120,235,255,.95), 0 0 24px rgba(60,210,255,.7), 0 2px 12px rgba(0,0,0,.8)",
                }}
              >
                MasterMindに繋がっています
              </span>
            </div>
            {/* パルス波形 */}
            <div className="mt-2 flex h-[18px] items-center gap-[3.5px]">
              {[0.5, 0.9, 0.65, 1, 0.75, 1, 0.6, 0.9, 0.5].map((h, i) => (
                <span
                  key={i}
                  className="inline-block w-[3px] rounded-full"
                  style={{
                    height: `${h * 18}px`,
                    background: "#8ff4ff",
                    boxShadow: "0 0 7px rgba(120,235,255,.9)",
                    animation: `mmEq 1.1s ease-in-out ${i * 0.11}s infinite`,
                    transformOrigin: "center",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tune-in中の顔ぶれ — 地球儀に重ねてズラーっと */}
        {faces && (
          <div className="absolute inset-x-2 top-8 z-30 rounded-2xl p-2.5" style={{ background: "rgba(5,10,20,.82)", border: "1px solid rgba(143,244,255,.35)" }} onClick={() => setFaces(null)}>
            <div className="mb-1.5 text-center text-[10px] font-bold tracking-[2px] text-[#8ff4ff]">
              いま地球と繋がっている人（{faces.length}人）
            </div>
            {faces.length === 0 ? (
              <p className="py-2 text-center text-[10.5px] text-[#5a7a9a]">いまはだれも繋がっていません</p>
            ) : (
              <div className="flex max-h-[120px] flex-wrap justify-center gap-1.5 overflow-y-auto">
                {faces.map((f, i) =>
                  f.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={f.avatar}
                      alt={f.name ?? ""}
                      title={f.name ?? ""}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full border border-[#8ff4ff]/50 object-cover"
                      style={{ boxShadow: "0 0 8px rgba(120,235,255,.5)" }}
                    />
                  ) : (
                    <span key={i} title={f.name ?? ""} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#8ff4ff]/40 bg-[#12283a] text-[11px] text-[#8ff4ff]">
                      {(f.name ?? "☺").slice(0, 1)}
                    </span>
                  )
                )}
              </div>
            )}
            <div className="mt-1 text-center text-[8.5px] text-[#4a6a8a]">タップで閉じる</div>
          </div>
        )}

        {/* 集計 — 南半球の下部に重ねる */}
        <div className="absolute bottom-1 left-0 right-0 flex items-end justify-center gap-8 text-center">
          <button
            type="button"
            className="pointer-events-auto"
            onClick={async () => {
              if (faces) { setFaces(null); return; }
              try {
                const { createClient } = await import("@/lib/supabase/client");
                const { data } = await createClient().rpc("otohikari_now_faces");
                setFaces(Array.isArray(data) ? data : []);
              } catch {
                setFaces([]);
              }
            }}
          >
            {stat(
              "Tune-in",
              <>
                {nowCount}
                <span className="ml-0.5 align-baseline text-[8px] font-normal">人</span>
              </>
            )}
          </button>
          {stat(
            "Today",
            <>
              {todayCount != null ? todayCount.toLocaleString() : "—"}
              <span className="ml-0.5 align-baseline text-[8px] font-normal">人</span>
            </>
          )}
          <a href="/schumann1/index.html" className="pointer-events-auto no-underline">
            {stat(
              "Now",
              <>
                {live.f1hz != null ? live.f1hz.toFixed(2) : "—"}
                <span className="ml-1 text-[13px]">Hz</span>
              </>
            )}
          </a>
        </div>
      </div>

      {/* 地球儀の下: △MasterMindSystem（同フォント・タップで F1〜F4 のグラフを展開） */}
      <details className="px-2 pb-1 pt-0.5" style={{ background: "#050a14" }}>
        <summary
          className="cursor-pointer list-none text-right text-[13px] font-extrabold tracking-[2px]"
          style={{
            color: "#8ff4ff",
            textShadow:
              "0 0 6px rgba(120,235,255,.95), 0 0 14px rgba(80,220,255,.7), 0 0 30px rgba(40,200,255,.5)",
          }}
        >
          △MasterMindSystem▽
        </summary>
        <div className="mt-2 space-y-1.5">
          {(["f1", "f2", "f3", "f4"] as const).map((k) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={k}
              src={`https://mitsulow.github.io/0Lei/graph_${k}.png?v=${encodeURIComponent(live.updated ?? "")}`}
              alt={`${k.toUpperCase()} グラフ`}
              loading="lazy"
              className="w-full rounded-lg border border-[#1a3048]"
            />
          ))}
        </div>
      </details>
    </section>
  );
}
