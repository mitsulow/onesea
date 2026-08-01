"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AUDIO, SCHUMANN, SCHUMANN_DATA_URL } from "@/lib/config";

const CACHE_NAME = "onesea-audio-v1";

function fmt(sec: number): string {
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type ProgramKind = "meditation" | "idea" | "synchro";

/**
 * MasterMindSystem — シューマン音©（令和八年夏至点）プレイヤー。
 * - 通常再生: ▶ ボタン
 * - 瞑想モード(10/15分): 鈴3打(実測シューマン×64Hz) → シューマン音 → 静寂 → 鈴3打
 * - アイディアモード: 1回再生 → 「浮かんだ単語を列挙」ダイアログ → マイページのアイディア一覧へ
 * - シンクロモード: 1回再生 → 「ふと、全体に繋がろう」(今日のDDP)
 * 再生・プログラム中は地球儀に「MasterMindに接続しています」が灯る。
 */
export function SchumannAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const countedRef = useRef(false);
  const suppressRef = useRef(false); // iOSの音声アンロック時にイベントを無視する

  const [user, setUser] = useState<User | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [dl, setDl] = useState<"loading" | "cached" | "stream">("loading");
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [loop, setLoop] = useState(false);
  const [showDlInfo, setShowDlInfo] = useState(false);

  /* モード（瞑想/アイディア/シンクロ） */
  const [modeOpen, setModeOpen] = useState(false);
  const [introKind, setIntroKind] = useState<Exclude<ProgramKind, "meditation"> | null>(null);
  const [program, setProgram] = useState<{ kind: ProgramKind; course?: number } | null>(null);
  const programRef = useRef(program);
  programRef.current = program;
  const [phase, setPhase] = useState("");
  const [remain, setRemain] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const countdownRef = useRef<number | null>(null);
  const bellCtx = useRef<AudioContext | null>(null);
  const liveF1 = useRef<number | null>(null);

  /* シンクロ(DDP)ダイアログ */
  const [showDdp, setShowDdp] = useState(false);
  const [ddpBody, setDdpBody] = useState("");
  const [ddpSaving, setDdpSaving] = useState(false);
  const [ddpSaved, setDdpSaved] = useState(false);

  /* アイディアダイアログ */
  const [showIdea, setShowIdea] = useState(false);
  const [ideaBody, setIdeaBody] = useState("");
  const [ideaSaving, setIdeaSaving] = useState(false);
  const [ideaSaved, setIdeaSaved] = useState(false);

  /* ---- セッション ---- */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
  }, []);

  /* ---- 実測F1（鈴の周波数 = F1 × 64） ---- */
  useEffect(() => {
    fetch(SCHUMANN_DATA_URL)
      .then((r) => r.json())
      .then((d) => {
        liveF1.current = d?.modes?.F1?.hz ?? null;
      })
      .catch(() => {});
  }, []);

  /* ---- 初回アクセスで端末に保存 ---- */
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
    // 行は消さない: 朝3:36リセットまで「今日再生した場所」として光り続ける
  }, []);

  const onPlayStarted = useCallback(async () => {
    if (suppressRef.current) return;
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
    if (suppressRef.current) return;
    setPlaying(false);
    countedRef.current = false;
    stopBeacon();
  }, [stopBeacon]);

  /* ---- MasterMind接続状態を地球儀へ通知 ---- */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("onesea:mm", { detail: { on: playing || program !== null } }));
  }, [playing, program]);

  /* ---- Wake Lock（プログラム中は画面を消さない） ---- */
  const wakeOn = useCallback(async () => {
    try {
      wakeRef.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {}
  }, []);
  const wakeOff = useCallback(async () => {
    try {
      await wakeRef.current?.release();
    } catch {}
    wakeRef.current = null;
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (programRef.current && document.visibilityState === "visible") wakeOn();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [wakeOn]);

  /* ---- シンギング・リン（WebAudio合成・実測シューマン×64Hz）
     柔らかいナチュラル版: 音量控えめ / ふわっと立ち上がる / ローパスで角を丸める /
     わずかにずれた2本の基音で本物のリンのような「うなり」を出す ---- */
  const ringBell = (ctx: AudioContext, freq: number, when: number, dur = 7) => {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(1400, freq * 3);
    lp.Q.value = 0.4;
    lp.connect(ctx.destination);
    const partials: Array<[number, number]> = [
      [1, 0.15],
      [1.004, 0.09], // うなり用（微妙にずらした基音）
      [2.72, 0.04],
      [5.41, 0.012],
    ];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(amp, when + 0.18); // 「ビクッ」としない立ち上がり
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g);
      g.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.1);
    }
  };

  const playBells = useCallback(async (): Promise<number> => {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = bellCtx.current && bellCtx.current.state !== "closed" ? bellCtx.current : new AC();
      bellCtx.current = ctx;
      await ctx.resume();
      const freq = (liveF1.current ?? SCHUMANN.hz) * 64;
      const t0 = ctx.currentTime + 0.15;
      for (let i = 0; i < 3; i++) ringBell(ctx, freq, t0 + i * 6);
      return 18;
    } catch {
      return 0;
    }
  }, []);

  /* ---- プログラム進行 ---- */
  const after = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  const stopCountdown = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setRemain(null);
  };

  const startCountdown = (sec: number) => {
    setRemain(sec);
    countdownRef.current = window.setInterval(() => {
      setRemain((r) => (r == null || r <= 1 ? 0 : r - 1));
    }, 1000);
  };

  const endProgram = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    stopCountdown();
    try {
      bellCtx.current?.close();
    } catch {}
    bellCtx.current = null;
    wakeOff();
    setProgram(null);
    setPhase("");
  }, [wakeOff]);

  const cancelProgram = useCallback(() => {
    const a = audioRef.current;
    if (a && !a.paused) a.pause();
    endProgram();
  }, [endProgram]);

  const beginProgram = async (kind: ProgramKind, course?: number) => {
    const a = audioRef.current;
    if (!a || !src || program) return;
    setModeOpen(false);
    setLoop(false);
    a.loop = false;
    setProgram({ kind, course });
    wakeOn();

    if (kind === "meditation") {
      // ユーザー操作の中で一度 play→pause して音声をアンロック（iOS対策）
      suppressRef.current = true;
      try {
        await a.play();
      } catch {}
      a.pause();
      a.currentTime = 0;
      suppressRef.current = false;

      setPhase("開始の鈴 — ゆっくり深呼吸");
      const bells = await playBells();
      startCountdown(bells);
      after(bells * 1000, () => {
        stopCountdown();
        setPhase("シューマン音");
        a.currentTime = 0;
        a.play().catch(() => {});
      });
    } else {
      setPhase(kind === "idea" ? "叡智に接続中 — イデアを受け取る" : "ふと、全体に繋がろう");
      a.currentTime = 0;
      a.play().catch(() => {});
    }
  };

  /* ---- 再生終了時の分岐 ---- */
  const openDdp = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const today = new Date();
    const day =
      today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    const { data } = await supabase.from("daily_ddp").select("body").eq("user_id", user.id).eq("day", day).maybeSingle();
    setDdpBody(data?.body ?? "");
    setDdpSaved(false);
    setShowDdp(true);
  }, [user]);

  const onEnded = useCallback(async () => {
    onStopped();
    const p = programRef.current;
    if (!p) return;
    if (p.kind === "meditation") {
      const track = dur || SCHUMANN_FALLBACK_SEC;
      const total = (p.course ?? 10) * 60;
      const silence = Math.max(30, Math.round(total - track - 36)); // 鈴2回ぶんを引いた静寂
      setPhase("静寂の瞑想");
      startCountdown(silence);
      after(silence * 1000, async () => {
        stopCountdown();
        setPhase("終わりの鈴");
        const bells = await playBells();
        after(bells * 1000, endProgram);
      });
    } else if (p.kind === "idea") {
      endProgram();
      setIdeaBody("");
      setIdeaSaved(false);
      setShowIdea(true);
    } else {
      endProgram();
      openDdp();
    }
  }, [onStopped, dur, playBells, endProgram, openDdp]);

  const saveDdp = useCallback(async () => {
    if (!user || !ddpBody.trim() || ddpSaving) return;
    setDdpSaving(true);
    const supabase = createClient();
    const today = new Date();
    const day =
      today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
    await supabase.from("daily_ddp").upsert({ user_id: user.id, day, body: ddpBody.trim() });
    setDdpSaving(false);
    setDdpSaved(true);
    setTimeout(() => setShowDdp(false), 900);
  }, [user, ddpBody, ddpSaving]);

  const saveIdea = useCallback(async () => {
    if (!user || !ideaBody.trim() || ideaSaving) return;
    setIdeaSaving(true);
    const supabase = createClient();
    await supabase.from("ideas").insert({ user_id: user.id, body: ideaBody.trim() });
    setIdeaSaving(false);
    setIdeaSaved(true);
    setTimeout(() => setShowIdea(false), 900);
  }, [user, ideaBody, ideaSaving]);

  useEffect(() => {
    return () => {
      wakeRef.current?.release().catch(() => {});
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      timers.current.forEach(clearTimeout);
      if (countdownRef.current) clearInterval(countdownRef.current);
      try {
        bellCtx.current?.close();
      } catch {}
      window.dispatchEvent(new CustomEvent("onesea:mm", { detail: { on: false } }));
    };
  }, []);

  const togglePlay = () => {
    // プログラム中は ▶(❚❚/■) でとっさに中止できる
    if (program) {
      cancelProgram();
      return;
    }
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

  const programLabel =
    program?.kind === "meditation"
      ? `🧘 瞑想モード（${program.course}分）`
      : program?.kind === "idea"
        ? "💡 アイディアモード"
        : "🌊 シンクロモード";

  return (
    <section
      className="card"
      style={{
        margin: "0 -16px",
        borderRadius: 0,
        border: "none",
        borderTop: "1.5px solid rgba(143,244,255,.85)", // OTOHIKARIと繋がる蛍光水色ライン
        boxShadow: "inset 0 2px 12px -2px rgba(143,244,255,.5)",
        background: "#0abab5",
        padding: "7px 12px 9px",
      }}
    >
      {/* タイトル行 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline">
          <span className="text-[13px]">⚡</span>
          <span
            className="text-[14px] font-extrabold tracking-wide text-white"
            style={{ textShadow: "0 0 8px rgba(143,244,255,.95), 0 0 18px rgba(80,220,255,.55)" }}
          >
            シューマン音
          </span>
          <span className="ml-1.5 text-[11.5px] text-white/85">（夏至 {SCHUMANN.hz}HZ）</span>
        </div>
        <button
          onClick={() => setShowDlInfo((v) => !v)}
          className="flex-shrink-0 rounded-full border border-white/60 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white/90"
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

      {/* 再生ボタン + 🔁 + モード + シークバー */}
      <div className="mt-1.5 flex items-center gap-2">
        <button
          onClick={togglePlay}
          disabled={!src}
          aria-label={program ? "モードを中止" : playing ? "一時停止" : "再生"}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] text-white shadow disabled:opacity-40"
          style={{ background: "linear-gradient(140deg,#a070ff,#8a5aff)" }}
        >
          {playing ? "❚❚" : program ? "■" : "▶"}
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          disabled={program !== null}
          aria-label="繰り返し再生"
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border text-[11px] disabled:opacity-40"
          style={
            loop
              ? { background: "#f0e8ff", borderColor: "#8a5aff", color: "#8a5aff" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          🔁
        </button>
        <button
          onClick={() => setModeOpen((v) => !v)}
          disabled={program !== null}
          className="h-6 flex-shrink-0 rounded-lg border px-2 text-[10px] font-bold disabled:opacity-40"
          style={
            modeOpen
              ? { background: "#f0e8ff", borderColor: "#8a5aff", color: "#8a5aff" }
              : { background: "#fff", borderColor: "#e0d6c6", color: "#8a8070" }
          }
        >
          モード{modeOpen ? "▴" : "▾"}
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
          <div className="flex justify-between text-[10.5px] leading-none text-white/85">
            <span className="num">{fmt(cur)}</span>
            <span className="num">{fmt(dur || SCHUMANN_FALLBACK_SEC)}</span>
          </div>
        </div>
      </div>

      {/* モード選択（選ぶ時だけ展開） */}
      {modeOpen && !program && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-white/25 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mode-meditation.webp" alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-white">瞑想モード</div>
                <div className="text-[9.5px] leading-snug text-white/80">鈴3打 → シューマン音 → 静寂 → 鈴3打</div>
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1.5">
              <button
                onClick={() => beginProgram("meditation", 10)}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#0a8a84]"
              >
                10分
              </button>
              <button
                onClick={() => beginProgram("meditation", 15)}
                className="rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#0a8a84]"
              >
                15分
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/25 pt-1.5">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mode-idea.webp" alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-white">アイディアモード</div>
                <div className="text-[9.5px] leading-snug text-white/80">全体からアイディアを降ろします</div>
              </div>
            </div>
            <button
              onClick={() => {
                setModeOpen(false);
                setIntroKind("idea");
              }}
              className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#0a8a84]"
            >
              はじめる
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/25 pt-1.5">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mode-synchro.webp" alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold text-white">シンクロモード</div>
                <div className="text-[9.5px] leading-snug text-white/80">今日の「やりたいこと」に許可を出す</div>
              </div>
            </div>
            <button
              onClick={() => {
                setModeOpen(false);
                setIntroKind("synchro");
              }}
              className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#0a8a84]"
            >
              はじめる
            </button>
          </div>
        </div>
      )}

      {/* プログラム進行表示 */}
      {program && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-white/25 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold tracking-wider text-white/90">{programLabel}</div>
            <div className="num text-[13px] font-bold text-white">
              {phase}
              {remain != null ? ` — ${fmt(remain)}` : ""}
            </div>
          </div>
          <button
            onClick={cancelProgram}
            className="flex-shrink-0 rounded-xl px-4 py-2 text-[13px] font-extrabold text-white shadow"
            style={{ background: "#e05040" }}
          >
            ■ 中止
          </button>
        </div>
      )}

      {/* モード開始前の手順ダイアログ */}
      {introKind && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: "rgba(6,12,20,0.6)", backdropFilter: "blur(3px)" }}
          onClick={() => setIntroKind(null)}
        >
          <div
            className="relative w-full max-w-[400px] rounded-2xl p-5 shadow-2xl"
            style={{ background: "linear-gradient(160deg,#0a1826,#12283a)", border: "1px solid #2a4a5e" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIntroKind(null)}
              aria-label="閉じる"
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-[#7a9ab4]"
            >
              ✕
            </button>
            <div className="text-center text-[16px] font-extrabold text-white">
              {introKind === "idea" ? "💡 アイディアモード" : "🌊 シンクロモード"}
            </div>
            <div className="mt-0.5 text-center text-[11px] text-[#7ab8d8]">
              {introKind === "idea" ? "全体からアイディアを降ろします" : "今日の「やりたいこと」に許可を出す"}
            </div>
            <ol className="mt-4 space-y-2.5">
              {(introKind === "idea"
                ? [
                    "MasterMindシステムに接続します",
                    "5分間、シューマン音を目を閉じて聴いてください",
                    "浮かんだアイディアを、1分以内にバラバラに単語でメモしてください",
                  ]
                : [
                    "MasterMindシステムに接続します",
                    "5分間、シューマン音を目を閉じて聴いてください",
                    "ふと、繋がった事を書き記してください",
                  ]
              ).map((step, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="num mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-extrabold"
                    style={{ background: "rgba(143,244,255,.12)", color: "#8ff4ff", border: "1px solid #8ff4ff55" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-relaxed text-[#cfe0ea]">{step}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={() => {
                const k = introKind;
                setIntroKind(null);
                beginProgram(k);
              }}
              className="mt-4 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-[#0a1826]"
              style={{
                background: "linear-gradient(135deg,#8ff4ff,#40d8f0)",
                boxShadow: "0 0 22px rgba(80,220,255,.4)",
              }}
            >
              MasterMindに接続する
            </button>
          </div>
        </div>
      )}

      {/* シンクロ（今日のDDP）ダイアログ */}
      {showDdp && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: "rgba(10,20,16,0.55)", backdropFilter: "blur(3px)" }}
          onClick={() => setShowDdp(false)}
        >
          <div className="relative w-full max-w-[400px] rounded-2xl bg-[#fffdf8] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowDdp(false)}
              aria-label="閉じる"
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#f0ebe0] text-[13px] font-bold text-[#a09888]"
            >
              ✕
            </button>
            <div className="text-center text-[15px] font-extrabold text-[#2a6a66]">🌊 ふと、全体に繋がろう</div>
            <div className="mt-0.5 text-center text-[11.5px] text-[#8a8070]">ふと、繋がった事を書き記してください</div>
            <textarea
              value={ddpBody}
              onChange={(e) => setDdpBody(e.target.value)}
              rows={4}
              maxLength={30}
              autoFocus
              placeholder={"シューマン瞑想で\n「ふと思った事」\n「ふと会いたくなった人」\n「ふと食べたくなったモノ」\n「ふと行きたくなった場所」を入力"}
              className="mt-3 w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-center text-[14px] leading-relaxed outline-none focus:border-[#0abab5]"
            />
            <button
              onClick={saveDdp}
              disabled={!ddpBody.trim() || ddpSaving}
              className="mt-2.5 w-full rounded-xl py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#0abab5" }}
            >
              {ddpSaved ? "刻みました 🌊" : ddpSaving ? "保存中..." : "セレンディピティ投稿"}
            </button>
            <p className="mt-1.5 text-center text-[9.5px] text-[#b8ae9c]">あなたのマイページに、日付ごとに表示されます</p>
          </div>
        </div>
      )}

      {/* アイディアダイアログ */}
      {showIdea && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: "rgba(10,16,24,0.55)", backdropFilter: "blur(3px)" }}
          onClick={() => setShowIdea(false)}
        >
          <div className="relative w-full max-w-[400px] rounded-2xl bg-[#fffdf8] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowIdea(false)}
              aria-label="閉じる"
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#f0ebe0] text-[13px] font-bold text-[#a09888]"
            >
              ✕
            </button>
            <div className="text-center text-[15px] font-extrabold text-[#7a5ac0]">💡 IDEA</div>
            <div className="mt-0.5 text-center text-[11.5px] text-[#8a8070]">叡智から降りてきたものを、逃さないで</div>
            <textarea
              value={ideaBody}
              onChange={(e) => setIdeaBody(e.target.value)}
              rows={4}
              autoFocus
              placeholder={"浮かんだアイディアを、1分以内に\nバラバラに単語でメモしてください"}
              className="mt-3 w-full resize-y rounded-xl border border-[#e0d8f0] bg-white p-3 text-center text-[14px] leading-relaxed outline-none focus:border-[#8a5aff]"
            />
            <button
              onClick={saveIdea}
              disabled={!ideaBody.trim() || ideaSaving}
              className="mt-2.5 w-full rounded-xl py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#a070ff,#8a5aff)" }}
            >
              {ideaSaved ? "刻みました 💡" : ideaSaving ? "保存中..." : "アイディアを保存する"}
            </button>
            <p className="mt-1.5 text-center text-[9.5px] text-[#b8ae9c]">あなたのマイページの「アイディア一覧」に貯まっていきます</p>
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
