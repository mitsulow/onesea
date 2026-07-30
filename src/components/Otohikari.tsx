"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { OtohikariGlobe } from "./OtohikariGlobe";
import { SCHUMANN, SCHUMANN_DATA_URL, TARGET_HZ } from "@/lib/config";

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
      setNowCount(Object.keys(channel.presenceState()).length);
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
    channelRef.current?.track({ at: new Date().toISOString() });
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
        border: "1px solid #24405a",
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
        <OtohikariGlobe pillars={Math.max(nowCount, playing ? 1 : 0)} />
      </div>

      {/* 実測ステータス */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/5 px-1 py-2">
          <div className="text-[9.5px] tracking-wider text-[#7a94b4]">いま</div>
          <div className="num text-lg font-extrabold leading-snug text-[#e8d8a8]">{nowCount}</div>
          <div className="text-[9px] text-[#6a84a4]">人が同時に</div>
        </div>
        <div className="rounded-xl bg-white/5 px-1 py-2">
          <div className="text-[9.5px] tracking-wider text-[#7a94b4]">きょう</div>
          <div className="num text-lg font-extrabold leading-snug text-[#e8d8a8]">
            {todayCount ?? "—"}
          </div>
          <div className="text-[9px] text-[#6a84a4]">回 鳴った</div>
        </div>
        <div className="rounded-xl bg-white/5 px-1 py-2">
          <div className="text-[9.5px] tracking-wider text-[#7a94b4]">地球の基音</div>
          <div className="num text-lg font-extrabold leading-snug text-[#e8d8a8]">
            {live.f1hz != null ? live.f1hz.toFixed(2) : "—"}
          </div>
          <div className="num text-[9px] text-[#6a84a4]">
            Hz{dist != null ? `（目標まで${dist > 0 ? "+" : ""}${dist.toFixed(2)}）` : ""}
          </div>
        </div>
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
