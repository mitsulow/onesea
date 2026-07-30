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
  const [showDdp, setShowDdp] = useState(false);
  const [ddpBody, setDdpBody] = useState("");
  const [ddpSaving, setDdpSaving] = useState(false);
  const [ddpSaved, setDdpSaved] = useState(false);

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

  // 最後まで聴き終えたら（瞑想おわり）→ 今日のDDPを聞く
  const onEnded = useCallback(async () => {
    onStopped();
    if (!user) return;
    const supabase = createClient();
    const today = new Date();
    const day = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const { data } = await supabase.from("daily_ddp").select("body").eq("user_id", user.id).eq("day", day).maybeSingle();
    setDdpBody(data?.body ?? "");
    setDdpSaved(false);
    setShowDdp(true);
  }, [user, onStopped]);

  const saveDdp = useCallback(async () => {
    if (!user || !ddpBody.trim() || ddpSaving) return;
    setDdpSaving(true);
    const supabase = createClient();
    const today = new Date();
    const day = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    await supabase.from("daily_ddp").upsert({ user_id: user.id, day, body: ddpBody.trim() });
    setDdpSaving(false);
    setDdpSaved(true);
    setTimeout(() => setShowDdp(false), 900);
  }, [user, ddpBody, ddpSaving]);

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
    <section className="card" style={{ margin: "0 -16px", borderRadius: 0, border: "none", background: "#0abab5" }}>
      {/* タイトル行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[15px]">⚡</span>
          <span className="text-[16px] font-extrabold tracking-wide text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.15)" }}>
            シューマン音
          </span>
          <span className="text-[12.5px] text-white/85">（夏至 {SCHUMANN.hz}HZ）</span>
        </div>
        <button
          onClick={() => setShowDlInfo((v) => !v)}
          className="flex-shrink-0 rounded-full border border-white/60 px-3 py-1 text-[10.5px] font-bold tracking-wider text-white/90"
        >
          DL INFO
        </button>
      </div>

      {showDlInfo && (
        <div className="mt-2 rounded-xl bg-white/85 px-3 py-2 text-[11.5px] leading-relaxed text-[#2a6a66]">
          {dl === "cached"
            ? "✅ 音源はこの端末に保存済みです。再生してもギガは減りません（初回の1回だけ約10MBをダウンロードします）。"
            : dl === "loading"
              ? "⏬ 音源をこの端末に保存しています…（約10MB・初回のみ）"
              : "🌐 いまはストリーミング再生です。通信環境の良い場所で開き直すと端末に保存されます。"}
        </div>
      )}

      {/* 左に小さな3ボタン + 長いシークバー */}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!src}
          aria-label={playing ? "一時停止" : "再生"}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-white shadow disabled:opacity-40"
          style={{ background: "linear-gradient(140deg,#a070ff,#8a5aff)" }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          aria-label="繰り返し再生"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border text-[11px]"
          style={
            loop
              ? { background: "#f0e8ff", borderColor: "#8a5aff", color: "#8a5aff" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          🔁
        </button>
        <button
          onClick={toggleMeditation}
          aria-label="瞑想モード（画面を消さない）"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border text-[11px]"
          style={
            meditation
              ? { background: "#f0e8ff", borderColor: "#8a5aff", color: "#8a5aff" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          🧘
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={dur || SCHUMANN_FALLBACK_SEC}
            step={0.1}
            value={cur}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-[#8a5aff]"
            aria-label="再生位置"
          />
          <div className="flex items-center justify-between text-[10.5px] leading-none text-white/85">
            <span className="num">{fmt(cur)}</span>
            <a
              href="https://mitsulow.github.io/schumann/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-white underline decoration-white/50 underline-offset-2"
            >
              今日のシューマン共振 ↗
            </a>
            <span className="num">{fmt(dur || SCHUMANN_FALLBACK_SEC)}</span>
          </div>
        </div>
      </div>

      {showDdp && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: "rgba(10,20,16,0.55)", backdropFilter: "blur(3px)" }}
        >
          <div className="w-full max-w-[400px] rounded-2xl bg-[#fffdf8] p-4 shadow-2xl">
            <div className="text-center text-[15px] font-extrabold text-[#2a6a66]">🧘 瞑想おつかれさま</div>
            <div className="mt-0.5 text-center text-[11.5px] text-[#8a8070]">今日のDDPを、ひとことで</div>
            <textarea
              value={ddpBody}
              onChange={(e) => setDdpBody(e.target.value)}
              rows={4}
              autoFocus
              placeholder={"シューマン瞑想で\n「ふと思った事」\n「ふと会いたくなった人」\n「ふと食べたくなったモノ」\n「ふと行きたくなった場所」を入力"}
              className="mt-3 w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-[#0abab5]"
            />
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => setShowDdp(false)} className="rounded-xl px-4 py-2.5 text-[12.5px] font-bold text-[#a09888]">
                あとで
              </button>
              <button
                onClick={saveDdp}
                disabled={!ddpBody.trim() || ddpSaving}
                className="flex-1 rounded-xl py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#0abab5" }}
              >
                {ddpSaved ? "刻みました 🌊" : ddpSaving ? "保存中..." : "今日のDDPを刻む"}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9.5px] text-[#b8ae9c]">あなたのマイページに、日付ごとに積み重なります</p>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        src={src ?? undefined}
        loop={loop}
        onPlay={onPlayStarted}
        onPause={onStopped}
        onEnded={onEnded}
        onTimeUpdate={(e) => setCur((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
      />
    </section>
  );
}

/** メタデータ未取得時のフォールバック表示（5:36） */
const SCHUMANN_FALLBACK_SEC = 336;
