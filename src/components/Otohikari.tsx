"use client";

import { useEffect, useState } from "react";
import { OtohikariGlobe } from "./OtohikariGlobe";
import { SCHUMANN, SCHUMANN_DATA_URL, TARGET_HZ } from "@/lib/config";
import { Cormorant_Garamond } from "next/font/google";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["600", "700"] });

interface SchumannLive {
  f1hz: number | null;
  updated: string | null;
}

/** [lat, lng, 人数] */
export type Spot = [number, number, number];

/**
 * OTOHIKARI — 光の音柱（本番・点呼方式）。
 * - 下り: /api/otohikari の30秒キャッシュJSONをポーリング（パケ死しない）
 * - 周波数: schumann 公式API v1 の実測値
 * - 再生と点呼の送信は SchumannAudioPlayer が担当
 */
export function Otohikari() {
  const [live, setLive] = useState<SchumannLive>({ f1hz: null, updated: null });
  const [nowCount, setNowCount] = useState(0);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);

  /* ---- シューマン共振 実測データ ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${SCHUMANN_DATA_URL}?t=${Date.now()}`);
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

  // 目標値まで「あと何Hz必要か」（目標 - 実測）
  const needed = live.f1hz != null ? TARGET_HZ - live.f1hz : null;

  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(160deg,#0a1826,#12283a)",
        border: "none",
        borderRadius: 0,
        margin: "0 -16px 0 -16px",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div
          className="sec"
          style={{
            color: "#8ff4ff",
            textShadow:
              "0 0 6px rgba(120,235,255,.95), 0 0 14px rgba(80,220,255,.7), 0 0 28px rgba(40,200,255,.45)",
          }}
        >
          OTOHIKARI — 光の音柱
        </div>
        {live.updated && (
          <span className="num text-[9.5px] text-[#5a7a9a]">
            実測 {new Date(live.updated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新
          </span>
        )}
      </div>

      <div style={{ margin: "8px -18px" }}>
        <OtohikariGlobe spots={spots} />
      </div>

      {/* ステータス（MMM OTOHIKARI と同じ見た目） */}
      <div className="mt-2 flex items-end justify-center gap-9 text-center">
        <div>
          <div className="text-[9px] tracking-[3px] text-[#7fa08c]">LISTENING NOW</div>
          <div
            className={`${serif.className} num text-[27px] font-semibold leading-tight text-[#b8f0c8]`}
            style={{ textShadow: "0 0 14px rgba(140,240,170,.55)" }}
          >
            {nowCount}
          </div>
        </div>
        <div>
          <div className="text-[9px] tracking-[3px] text-[#7fa08c]">TODAY</div>
          <div
            className={`${serif.className} num text-[27px] font-semibold leading-tight text-[#b8f0c8]`}
            style={{ textShadow: "0 0 14px rgba(140,240,170,.55)" }}
          >
            {todayCount != null ? todayCount.toLocaleString() : "—"}
          </div>
        </div>
        <div>
          <div className="text-[9px] tracking-[3px] text-[#7fa08c]">TARGET SCHUMANN</div>
          <div
            className={`${serif.className} num text-[27px] font-semibold leading-tight text-[#b8f0c8]`}
            style={{ textShadow: "0 0 14px rgba(140,240,170,.55)" }}
          >
            {SCHUMANN.hz}
            <span className="ml-1 text-[14px]">Hz</span>
          </div>
        </div>
      </div>
      <div className="num mt-1.5 text-center text-[11px] text-[#8aa8d0]">
        今のシューマン電磁波 {live.f1hz != null ? live.f1hz.toFixed(2) : "—"}Hz
        {needed != null
          ? `（目標値まで${needed >= 0 ? "＋" : "−"}${Math.abs(needed).toFixed(2)}Hz）`
          : ""}
      </div>
      <div className="mt-0.5 text-center">
        <a
          href="https://mitsulow.github.io/schumann/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9.5px] text-[#5a7a9a] underline decoration-[#5a7a9a]/50 underline-offset-2"
        >
          実際の値をチェック ↗
        </a>
      </div>
    </section>
  );
}
