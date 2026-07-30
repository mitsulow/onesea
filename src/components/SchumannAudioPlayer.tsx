"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AUDIO, SCHUMANN } from "@/lib/config";

const CACHE_NAME = "onesea-audio-v1";

function fmt(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * シューマン音©（令和八年夏至点）プレイヤー — MMM の再生セクションを踏襲。
 * - 初回アクセスで端末に保存（Cache API）→ 以後はローカル再生（ギガも帯域も減らない）
 * - シークバー（いまどこを聴いているか）/ 🔁 繰り返し / 🧘 瞑想モード（画面を消さない）
 * - 再生中は点呼（beacons）で地球儀にホタルが灯り、listens で今日の回数が増える
 */
export function SchumannAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const countedRef = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [dl, setDl] = useState<"loading" | "cached" | "stream">("loading");
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [loop, setLoop] = useState(false);
  const [meditation, setMeditation] = useState(false);
  const [showDlInfo, setShowDlInfo] = useState(false);

  /* ---- セッション ---- */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
  }, []);

  /* ---- 初回アクセスで端末に保存（エンジニアさん方式を踏襲） ---- */
  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!("caches" in window)) {
          setSrc(AUDIO.fallbackUrl);
          setDl("stream");
          return;
        }
        const cache = await caches.open(CACHE_NAME);
        let res = await cache.match(AUDIO.url);
        if (!res) {
          setDl("loading");
          let net = await fetch(AUDIO.url).catch(() => null);
          if (!net || !net.ok) net = await fetch(AUDIO.fallbackUrl).catch(() => null);
          if (net && net.ok) {
            await cache.put(AUDIO.url, net.clone());
            res = net;
          }
        }
        if (cancelled) return;
        if (res) {
          const blob = await res.blob();
          revoke = URL.createObjectURL(blob);
          setSrc(revoke);
          setDl("cached");
        } else {
          setSrc(AUDIO.fallbackUrl);
          setDl("stream");
        }
      } catch {
        if (!cancelled) {
          setSrc(AUDIO.fallbackUrl);
          setDl("stream");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  /* ---- 点呼（再生中だけ地球儀に灯る） ---- */
  const sendBeacon = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    await supabase.from("beacons").upsert({
      user_id: user.id,
      lat: posRef.current?.lat ?? null,
      lng: posRef.current?.lng ?? null,
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

  const onPlayStarted = useCallback(async () => {
    setPlaying(true);
    if (!posRef.current && navigator.geolocation) {
      posRef.current = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { timeout: 4000, maximumAge: 600000 }
        );
      });
    }
    sendBeacon();
    if (!heartbeatRef.current) heartbeatRef.current = setInterval(sendBeacon, 30000);
    if (user && !countedRef.current) {
      countedRef.current = true;
      const supabase = createClient();
      await supabase.from("listens").insert({ user_id: user.id });
    }
  }, [user, sendBeacon]);

  const onStopped = useCallback(() => {
    setPlaying(false);
    countedRef.current = false;
    stopBeacon();
  }, [stopBeacon]);

  /* ---- 瞑想モード: 画面を消さない（Wake Lock） ---- */
  const toggleMeditation = useCallback(async () => {
    if (meditation) {
      setMeditation(false);
      try {
        await wakeRef.current?.release();
      } catch {}
      wakeRef.current = null;
      return;
    }
    setMeditation(true);
    try {
      wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {}
  }, [meditation]);

  // 画面復帰時に Wake Lock を取り直す
  useEffect(() => {
    const onVis = async () => {
      if (meditation && document.visibilityState === "visible") {
        try {
          wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [meditation]);

  useEffect(() => {
    return () => {
      wakeRef.current?.release().catch(() => {});
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (playing) a.pause();
    else a.play().catch(() => {});
  };

  const seek = (v: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v;
    setCur(v);
  };

  return (
    <section className="card" style={{ margin: "0 -16px", borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
      {/* タイトル行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[15px]">⚡</span>
          <span className="text-[16px] font-extrabold tracking-wide" style={{ color: "#3e9b6c" }}>
            シューマン音
          </span>
          <span className="text-[12.5px] text-[#a09888]">（夏至 {SCHUMANN.hz}HZ）</span>
        </div>
        <button
          onClick={() => setShowDlInfo((v) => !v)}
          className="flex-shrink-0 rounded-full border border-[#e0d6c6] px-3 py-1 text-[10.5px] font-bold tracking-wider text-[#a09888]"
        >
          DL INFO
        </button>
      </div>

      {showDlInfo && (
        <div className="mt-2 rounded-xl bg-[#f4f0e6] px-3 py-2 text-[11.5px] leading-relaxed text-[#8a7a5a]">
          {dl === "cached"
            ? "✅ 音源はこの端末に保存済みです。再生してもギガは減りません（初回の1回だけ約10MBをダウンロードします）。"
            : dl === "loading"
              ? "⏬ 音源をこの端末に保存しています…（約10MB・初回のみ）"
              : "🌐 いまはストリーミング再生です。通信環境の良い場所で開き直すと端末に保存されます。"}
        </div>
      )}

      {/* シークバー */}
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={dur || SCHUMANN_FALLBACK_SEC}
          step={0.1}
          value={cur}
          onChange={(e) => seek(Number(e.target.value))}
          className="w-full accent-[#3e9b6c]"
          aria-label="再生位置"
        />
        <div className="flex justify-between text-[12px] text-[#a09888]">
          <span className="num">{fmt(cur)}</span>
          <span className="num">{fmt(dur || SCHUMANN_FALLBACK_SEC)}</span>
        </div>
      </div>

      {/* 操作ボタン */}
      <div className="mt-1 flex items-center justify-end gap-2.5">
        <button
          onClick={togglePlay}
          disabled={!src}
          aria-label={playing ? "一時停止" : "再生"}
          className="flex h-14 w-14 items-center justify-center rounded-full text-xl text-white shadow-md disabled:opacity-40"
          style={{ background: "linear-gradient(140deg,#5cbe8c,#3e9b6c)" }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          aria-label="繰り返し再生"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border text-lg"
          style={
            loop
              ? { background: "#eaf6ee", borderColor: "#3e9b6c", color: "#3e9b6c" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          🔁
        </button>
        <button
          onClick={toggleMeditation}
          aria-label="瞑想モード（画面を消さない）"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border text-lg"
          style={
            meditation
              ? { background: "#eaf6ee", borderColor: "#3e9b6c", color: "#3e9b6c" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          🧘
        </button>
      </div>


      <audio
        ref={audioRef}
        src={src ?? undefined}
        loop={loop}
        onPlay={onPlayStarted}
        onPause={onStopped}
        onEnded={onStopped}
        onTimeUpdate={(e) => setCur((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
      />
    </section>
  );
}

/** メタデータ未取得時のフォールバック表示（5:36） */
const SCHUMANN_FALLBACK_SEC = 336;
