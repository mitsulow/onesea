"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  /* ---- 地球儀 Canvas ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SIZE = 220;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const g = canvas.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);

    // 点描の球（緯度経度グリッド）
    const pts: Array<[number, number, number]> = [];
    for (let lat = -75; lat <= 75; lat += 12) {
      const r = Math.cos((lat * Math.PI) / 180);
      const y = Math.sin((lat * Math.PI) / 180);
      const n = Math.max(6, Math.round(26 * r));
      for (let i = 0; i < n; i++) {
        const lon = (i / n) * Math.PI * 2;
        pts.push([r * Math.cos(lon), y, r * Math.sin(lon)]);
      }
    }
    // 光の柱の位置（presence 数ぶん表示。位置は決定的に散らす）
    const pillarPos = (idx: number): [number, number, number] => {
      const a = (idx * 2.399963) % (Math.PI * 2); // 黄金角
      const y = ((idx * 0.618) % 1.4) - 0.7;
      const r = Math.sqrt(1 - y * y);
      return [r * Math.cos(a), y, r * Math.sin(a)];
    };

    let raf = 0;
    const R = 88;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    let rot = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      rot += dt * 0.22;
      g.clearRect(0, 0, SIZE, SIZE);

      // 背後の靄
      const halo = g.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.45);
      halo.addColorStop(0, "rgba(60,130,190,0.16)");
      halo.addColorStop(1, "rgba(60,130,190,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, SIZE, SIZE);

      // 球体の点描
      for (const [x0, y0, z0] of pts) {
        const x = x0 * Math.cos(rot) + z0 * Math.sin(rot);
        const z = -x0 * Math.sin(rot) + z0 * Math.cos(rot);
        const px = cx + x * R;
        const py = cy - y0 * R;
        const front = z > 0;
        const alpha = front ? 0.28 + z * 0.5 : 0.06;
        const size = front ? 1.4 + z * 0.9 : 1;
        g.beginPath();
        g.arc(px, py, size, 0, Math.PI * 2);
        g.fillStyle = `rgba(122,184,216,${alpha})`;
        g.fill();
      }

      // 縁のリング（金）
      g.beginPath();
      g.arc(cx, cy, R + 6, 0, Math.PI * 2);
      g.strokeStyle = "rgba(212,185,106,0.28)";
      g.lineWidth = 1;
      g.stroke();

      // 光の柱（いま聴いている人）
      const pillars = Math.min(Math.max(nowCount, playingRef.current ? 1 : 0), 14);
      for (let i = 0; i < pillars; i++) {
        const [x0, y0, z0] = pillarPos(i);
        const x = x0 * Math.cos(rot * 0.8) + z0 * Math.sin(rot * 0.8);
        const z = -x0 * Math.sin(rot * 0.8) + z0 * Math.cos(rot * 0.8);
        if (z < -0.15) continue; // 裏側は描かない
        const px = cx + x * R;
        const py = cy - y0 * R;
        const pulse = 0.7 + 0.3 * Math.sin(now / 400 + i * 1.7);
        const h = 26 * pulse;
        const grad = g.createLinearGradient(px, py, px, py - h);
        grad.addColorStop(0, "rgba(255,224,138,0.9)");
        grad.addColorStop(1, "rgba(255,224,138,0)");
        g.fillStyle = grad;
        g.fillRect(px - 1.2, py - h, 2.4, h);
        g.beginPath();
        g.arc(px, py, 2.6, 0, Math.PI * 2);
        g.fillStyle = "rgba(255,224,138,0.95)";
        g.shadowColor = "rgba(255,220,130,0.9)";
        g.shadowBlur = 8 * pulse;
        g.fill();
        g.shadowBlur = 0;
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [nowCount]);

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

      <canvas
        ref={canvasRef}
        style={{ width: 220, height: 220 }}
        className="mx-auto my-1 block"
        aria-label="地球儀 — 光の柱はいま聴いている人"
      />

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
