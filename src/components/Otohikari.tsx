"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { OtohikariGlobe } from "./OtohikariGlobe";
import { SCHUMANN, SCHUMANN_DATA_URL, TARGET_HZ } from "@/lib/config";
import { Cormorant_Garamond } from "next/font/google";

const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["600", "700"] });

interface SchumannLive {
  f1hz: number | null;
  amp: number | null;
  updated: string | null;
  notes: string | null;
}

/**
 * OTOHIKARI — 光の音柱（本番）。
 * - 地球儀: Canvas 描画（回転する点描の球 + 聴いている人数ぶんの光の柱）
 * - 周波数: schumann 公式API v1 の実測値
 * - いま: Supabase Realtime presence（再生中の人だけが光る）
 * - きょう: listens テーブルの実カウント
 * - シューマン音©: Web Audio 合成（無料10秒フェード）
 */
export function Otohikari() {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const ctxAudioRef = useRef<AudioContext | null>(null);
  const playingRef = useRef(false);

  const [live, setLive] = useState<SchumannLive>({ f1hz: null, amp: null, updated: null, notes: null });
  const [nowCount, setNowCount] = useState(0);
  const [spots, setSpots] = useState<Array<[number, number] | null>>([]);
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  /* ---- 実測データ ---- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${SCHUMANN_DATA_URL}?t=${Date.now()}`);
        const d = await res.json();
        if (cancelled) return;
        setLive({
          f1hz: d?.modes?.F1?.hz ?? null,
          amp: d?.modes?.F1?.amp ?? null,
          updated: d?.timestamp ?? null,
          notes: d?.notes ?? null,
        });
      } catch {
        /* 表示は "—" のまま */
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  /* ---- presence（いま聴いている人）+ 今日の回数 ---- */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));

    const channel = supabase.channel("otohikari", {
      config: { presence: { key: crypto.randomUUID() } },
    });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<{ lat?: number; lng?: number }>>;
      const keys = Object.keys(state);
      setNowCount(keys.length);
      setSpots(
        keys.map((k) => {
          const m = state[k]?.[0];
          return typeof m?.lat === "number" && typeof m?.lng === "number"
            ? ([m.lat, m.lng] as [number, number])
            : null;
        })
      );
    });
    channel.subscribe();
    channelRef.current = channel;

    supabase.rpc("today_listens").then(({ data }) => {
      if (typeof data === "number") setTodayCount(data);
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  /* ---- 再生（Web Audio 合成・帯域ゼロ） ---- */
  const toggle = useCallback(async () => {
    if (ctxAudioRef.current) {
      ctxAudioRef.current.close().catch(() => {});
      ctxAudioRef.current = null;
      playingRef.current = false;
      setPlaying(false);
      channelRef.current?.untrack();
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
        playingRef.current = false;
        setPlaying(false);
        channelRef.current?.untrack();
      }
    };
    ctxAudioRef.current = ctx;
    playingRef.current = true;
    setPlaying(true);

    // 本番カウント: presence で「いま」、listens で「きょう」
    // 現在地は 0.5°（約50km）に丸めてから送る — 個人の正確な位置は扱わない
    const coarse = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: Math.round(pos.coords.latitude * 2) / 2,
            lng: Math.round(pos.coords.longitude * 2) / 2,
          }),
        () => resolve(null),
        { timeout: 4000, maximumAge: 600000 }
      );
    });
    channelRef.current?.track(
      coarse ? { at: new Date().toISOString(), lat: coarse.lat, lng: coarse.lng } : { at: new Date().toISOString() }
    );
    if (user) {
      const supabase = createClient();
      await supabase.from("listens").insert({ user_id: user.id });
      const { data } = await supabase.rpc("today_listens");
      if (typeof data === "number") setTodayCount(data);
    }
  }, [user]);

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
