"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
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
 * - 上り: 再生中の端末が30秒ごとに beacons へ点呼（約100バイト）
 * - 集計: SQL 1発（otohikari_snapshot）
 * - 下り: /api/otohikari の30秒キャッシュJSONをポーリング —
 *   利用者数が増えてもDB負荷・転送量は一定（パケ死しない）
 * - 周波数: schumann 公式API v1 の実測値
 * - シューマン音©: Web Audio 合成（無料10秒フェード）
 */
export function Otohikari() {
  const ctxAudioRef = useRef<AudioContext | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coarseRef = useRef<{ lat: number; lng: number } | null>(null);

  const [live, setLive] = useState<SchumannLive>({ f1hz: null, updated: null });
  const [nowCount, setNowCount] = useState(0);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [playing, setPlaying] = useState(false);
  const [user, setUser] = useState<User | null>(null);

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
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));

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

  /* ---- 点呼（beacon upsert）---- */
  const sendBeacon = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("beacons").upsert({
      user_id: user.id,
      lat: coarseRef.current?.lat ?? null,
      lng: coarseRef.current?.lng ?? null,
      last_seen: new Date().toISOString(),
    });
  }, [user]);

  const stopBeacon = useCallback(async () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (!user) return;
    const supabase = createClient();
    await supabase.from("beacons").delete().eq("user_id", user.id);
  }, [user]);

  /* ---- 再生（Web Audio 合成・帯域ゼロ） ---- */
  const toggle = useCallback(async () => {
    if (ctxAudioRef.current) {
      ctxAudioRef.current.close().catch(() => {});
      ctxAudioRef.current = null;
      setPlaying(false);
      stopBeacon();
      return;
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const carrier = ctx.createOscillator();
    carrier.type = "sine";
    carrier.frequency.value = SCHUMANN.hz * SCHUMANN.mult;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = SCHUMANN.hz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    carrier.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    const dur = SCHUMANN.freeSec;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.25, t0 + 1.2);
    gain.gain.setValueAtTime(0.25, t0 + dur - 2.5);
    gain.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    carrier.start(t0);
    lfo.start(t0);
    carrier.stop(t0 + dur);
    lfo.stop(t0 + dur);
    carrier.onended = () => {
      if (ctxAudioRef.current === ctx) {
        ctx.close().catch(() => {});
        ctxAudioRef.current = null;
        setPlaying(false);
        stopBeacon();
      }
    };
    ctxAudioRef.current = ctx;
    setPlaying(true);

    // 現在地（ユーザー方針: 丸めずそのまま使う）
    coarseRef.current = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 4000, maximumAge: 600000 }
      );
    });

    // 点呼開始 + きょうの実カウント
    sendBeacon();
    heartbeatRef.current = setInterval(sendBeacon, 30000);
    if (user) {
      const supabase = createClient();
      await supabase.from("listens").insert({ user_id: user.id });
      const { data } = await supabase.rpc("today_listens");
      if (typeof data === "number") setTodayCount(data);
    }
    // 自分の光は即時に見せる（次のスナップショット反映を待たない）
    setNowCount((n) => Math.max(n, 1));
    if (coarseRef.current) {
      const me: Spot = [coarseRef.current.lat, coarseRef.current.lng, 1];
      setSpots((prev) => [...prev, me]);
    }
  }, [user, sendBeacon, stopBeacon]);

  const dist = live.f1hz != null ? live.f1hz - TARGET_HZ : null;

  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(160deg,#0a1826,#12283a)",
        border: "none",
        borderRadius: 0,
        margin: "0 -16px",
      }}
    >
      <div className="flex items-baseline justify-between">
        <div className="sec" style={{ color: "#8aa8d0" }}>
          OTOHIKARI — 光の音柱
        </div>
        {live.updated && (
          <span className="num text-[9.5px] text-[#5a7a9a]">
            実測 {new Date(live.updated).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 更新
          </span>
        )}
      </div>

      <div className="my-2">
        <OtohikariGlobe spots={spots.length ? spots : playing ? [null] : []} />
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
      <div className="num mt-1 text-center text-[9.5px] text-[#5a7a9a]">
        実測 F1 {live.f1hz != null ? live.f1hz.toFixed(2) : "—"}Hz
        {dist != null ? `（目標まで${dist > 0 ? "+" : ""}${dist.toFixed(2)}）` : ""}
      </div>

      {/* シューマン音© 再生 */}
      <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <button
          onClick={toggle}
          aria-label={playing ? "停止" : "シューマン音©を聴く"}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-lg text-white shadow-md"
          style={{ background: "linear-gradient(140deg,#5cbe8c,#3e9b6c)" }}
        >
          {playing ? "■" : "▶"}
        </button>
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold text-[#d8e8dc]">
            シューマン音© {SCHUMANN.label} {SCHUMANN.hz}Hz
          </div>
          <div className="text-[11px] leading-relaxed text-[#7a94b4]">
            {playing
              ? `再生中 — あなたの光が地球に灯っています（${SCHUMANN.freeSec}秒でフェード）`
              : `ブラウザ内合成。無料ではじめの${SCHUMANN.freeSec}秒だけ試聴できます`}
          </div>
        </div>
      </div>
    </section>
  );
}
