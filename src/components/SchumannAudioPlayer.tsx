"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchIsWarawa } from "@/lib/warawa";
import { AUDIO, SCHUMANN, SCHUMANN_DATA_URL } from "@/lib/config";
import { UpgradeDialog } from "@/components/UpgradeGate";
import {
  MED_DEFAULTS,
  buildTimeline,
  fetchMeasuredModes,
  startMedSession,
  type MedConfig,
  type MedSession,
} from "@/lib/meditationAudio";

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
 * - 瞑想モード(10/15/30分・トータル制): 間→鈴3打(実測シューマン×64Hz)→間→シューマン音→間→鐘1打
 *   →静寂(F1〜F4可聴ドローン+ヘミシンクL/R差7.83Hz+黄金比ゆらぎ)→鐘3打。全てAudioClock予約で画面オフ対応
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
  const [warawa, setWarawa] = useState(false); // わらわ〜会員=フル再生・プログラム解禁
  const previewDoneRef = useRef(false); // 無料試聴15秒を使い切ったか（ページ再読込までロック）
  const [src, setSrc] = useState<string | null>(null);
  const [dl, setDl] = useState<"loading" | "cached" | "stream">("loading");
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [loop, setLoop] = useState(false);
  const [showDlInfo, setShowDlInfo] = useState(false);

  /* モード（瞑想/アイディア/シンクロ） */
  const [modeOpen, setModeOpen] = useState(false);
  /* 無料アプリ: 未ログインは15秒プレビューのみ。モードは会員専用 */
  const [showUpgrade, setShowUpgrade] = useState(false);
  useEffect(() => {
    // 再マウントやレンダリングでポップアップが勝手に消えないよう、閉じるまでセッションに保持
    try {
      if (sessionStorage.getItem("schumann-upsell") === "1") {
        previewDoneRef.current = true;
        setShowUpgrade(true);
      }
    } catch {}
  }, []);
  const previewRef = useRef<number | null>(null);
  const [introKind, setIntroKind] = useState<Exclude<ProgramKind, "meditation"> | null>(null);
  const [program, setProgram] = useState<{ kind: ProgramKind; course?: number; mode?: string } | null>(null);
  const [medPick] = useState<string>("random"); // 脳波モード（アイディア/シンクロ用に残置）
  const programRef = useRef(program);
  programRef.current = program;
  const [phase, setPhase] = useState("");
  const [remain, setRemain] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const countdownRef = useRef<number | null>(null);
  const medRef = useRef<MedSession | null>(null);
  const liveModes = useRef<number[] | null>(null);

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

  /* ---- セッション + わらわ〜会員判定 ---- */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setWarawa(await fetchIsWarawa(u?.id));
    });
  }, []);

  /* ---- 実測シューマンF1〜F4（不思議な音のキャリア + 鐘 = F1×64） ---- */
  useEffect(() => {
    fetchMeasuredModes(SCHUMANN_DATA_URL).then((r) => {
      liveModes.current = r.modes;
    });
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
    // 位置が取れない時は lat/lng を送らない = 既存の座標を null で上書きしない
    // （機内などで再生し直すと、朝ホテルで灯した光が消える事故があった）
    const payload: { user_id: string; last_seen: string; lat?: number; lng?: number } = {
      user_id: user.id,
      last_seen: new Date().toISOString(),
    };
    if (posRef.current) {
      payload.lat = posRef.current.lat;
      payload.lng = posRef.current.lng;
    }
    await supabase.from("beacons").upsert(payload);
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
    // ゲスト・無料会員: 15秒ぶんだけ試聴。使い切った後は再生ボタンを押しても始まらない
    // （時限タイマー式だと閉じて押し直すたび15秒ずつ聴けてしまうバグがあったため、
    //   再生位置ベースのハードキャップに変更。超過検知は onTimeUpdate 側）
    if (!warawa && previewDoneRef.current) {
      audioRef.current?.pause();
      setShowUpgrade(true);
      return;
    }
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
      // 「聞いた時に居た場所」を記録 → その日じゅう地球儀に灯る(snapshot側でlistensから集計)
      await supabase.from("listens").insert({
        user_id: user.id,
        lat: posRef.current?.lat ?? null,
        lng: posRef.current?.lng ?? null,
      });
    }
  }, [user, warawa, sendBeacon]);

  const onStopped = useCallback(() => {
    if (suppressRef.current) return;
    if (previewRef.current) {
      clearTimeout(previewRef.current);
      previewRef.current = null;
    }
    setPlaying(false);
    countedRef.current = false;
    stopBeacon();
  }, [stopBeacon]);

  /* ---- MasterMind接続状態を地球儀へ通知 ---- */
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("onesea:mm", { detail: { on: playing || program !== null } }));
  }, [playing, program]);

  /* ---- プログラム中はTUNINGを灯し続ける ----
     瞑想モードは<audio>のシューマン音が終わると「不思議な音」(Web Audio)に移り、
     <audio>のonEndedでstopBeaconされてしまう。プログラムが続く限り点呼を打ち直し、
     瞑想／アイディア／シンクロのどれでも「今聞いている人」に確実に+1する。 */
  useEffect(() => {
    if (!program || !user) return;
    sendBeacon();
    const iv = setInterval(sendBeacon, 30000);
    return () => clearInterval(iv);
  }, [program, user, sendBeacon]);

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
    suppressRef.current = false; // 瞑想開始の解錠フラグが残らないように
    stopCountdown();
    medRef.current?.stop();
    medRef.current = null;
    wakeOff();
    setProgram(null);
    setPhase("");
  }, [wakeOff]);

  const cancelProgram = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.muted = false;
      if (!a.paused) a.pause();
    }
    endProgram();
  }, [endProgram]);

  const beginProgram = async (kind: ProgramKind, course?: number) => {
    if (!warawa) {
      setModeOpen(false);
      setShowUpgrade(true);
      return;
    }
    const a = audioRef.current;
    if (!a || !src || program) return;
    setModeOpen(false);
    setLoop(false);
    a.loop = false;
    setProgram({ kind, course, mode: medPick });
    wakeOn();

    if (kind === "meditation") {
      // 座る間をつくるため、押してから2秒待ち、2秒後に「最初から」鳴らす。
      // 以前は無音のまま再生を進めていたので曲の頭が飛んでいた。
      // ここでは一瞬だけ無音で play→pause して iOS の音声解錠だけ済ませ、
      // 実際の再生は2秒後に currentTime=0 から始める。
      setPhase("そっと目を閉じて…（まもなく始まります）");
      suppressRef.current = true; // 解錠用の play/pause で点呼・状態が動かないように
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
      after(2000, () => {
        suppressRef.current = false;
        a.muted = false;
        a.currentTime = 0; // 必ず最初から
        a.play().catch(() => {});
        setPhase("シューマン音");
      });
    } else {
      a.muted = false;
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
      // シューマン音が終わったら: 鐘1打と同時に「不思議な音」が高い方から現れる。
      // 進行（滞在/PAN/鳴ったまま終わりの鐘3打 → 1本ずつ退場）はすべて
      // エンジンが AudioContext の時計に予約済み（画面が消えても音は正しく進む）
      const track = dur || SCHUMANN_FALLBACK_SEC;
      const total = (p.course ?? 10) * 60; // 「トータルで」選んだ分数
      const cfg: MedConfig = { ...MED_DEFAULTS };
      try {
        const saved = localStorage.getItem("onesea-med-cfg2");
        if (saved) Object.assign(cfg, JSON.parse(saved));
      } catch {}
      cfg.brainMode = p.mode ?? "random"; // 10分+γ のように選ばれていればそれ、無指定はランダム
      // エンジンの固定部（登場+PAN×2+鐘+退場）を差し引いて滞在時間を決める
      const fixedLen = buildTimeline({ ...cfg, dwell: 0 }, liveModes.current ?? undefined).total;
      cfg.dwell = Math.max(40, Math.round((total - track - fixedLen) / 2.6));
      const tl = buildTimeline(cfg, liveModes.current ?? undefined);
      setPhase(`不思議な音（${tl.mode}モード・基音${tl.baseHz.toFixed(1)}Hz）— 遠くの気配に身をゆだねる`);
      try {
        medRef.current = startMedSession(cfg, tl);
      } catch {}
      startCountdown(Math.round(tl.total));
      after(Math.round(tl.total) * 1000 + 1200, endProgram);
    } else if (p.kind === "idea") {
      endProgram();
      setIdeaBody("");
      setIdeaSaved(false);
      setShowIdea(true);
    } else {
      endProgram();
      openDdp();
    }
  }, [onStopped, dur, endProgram, openDdp]);

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
      medRef.current?.stop();
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
      ? `瞑想モード（${program.course}分）`
      : program?.kind === "idea"
        ? "アイディアモード"
        : "シンクロモード";

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
        padding: "4px 12px 5px",
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
        <div className="mt-1.5 rounded-xl bg-white/85 px-3 py-1.5 text-[11.5px] leading-relaxed text-[#2a6a66]">
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
                <div className="text-[9.5px] leading-snug text-white/80">地球の音で休息を取ります</div>
              </div>
            </div>
            <button
              onClick={() => {
                setModeOpen(false);
                if (!user) return setShowUpgrade(true);
                window.location.href = "/meditation-alpha";
              }}
              className="flex-shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-[11.5px] font-extrabold text-[#0a8a84]"
            >
              はじめる
            </button>
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
                if (!user) return setShowUpgrade(true);
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
                if (!user) return setShowUpgrade(true);
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
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-white/25 px-3 py-1.5">
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
              {introKind === "idea" ? "アイディアモード" : "シンクロモード"}
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
            <div className="text-center text-[15px] font-extrabold text-[#2a6a66]"><img src="/icons/icon-wave.webp" alt="" style={{ width: 17, height: 17, display: "inline", verticalAlign: -3 }} /> ふと、全体に繋がろう</div>
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
              {ddpSaved ? "刻みました" : ddpSaving ? "保存中..." : "セレンディピティ投稿"}
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
            <div className="text-center text-[15px] font-extrabold text-[#7a5ac0]"><img src="/icons/icon-bulb.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -2.5 }} /> IDEA</div>
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
              {ideaSaved ? "刻みました" : ideaSaving ? "保存中..." : "アイディアを保存する"}
            </button>
            <p className="mt-1.5 text-center text-[9.5px] text-[#b8ae9c]">あなたのマイページの「アイディア一覧」に貯まっていきます</p>
          </div>
        </div>
      )}

      <UpgradeDialog open={showUpgrade} onClose={() => { try { sessionStorage.removeItem("schumann-upsell"); } catch {} setShowUpgrade(false); }} feature="シューマン音のフル再生" lp="/lp/mmm" />
      <audio
        ref={audioRef}
        src={src ?? undefined}
        loop={loop}
        onPlay={onPlayStarted}
        onPause={onStopped}
        onEnded={onEnded}
        onTimeUpdate={(e) => {
          const a = e.target as HTMLAudioElement;
          setCur(a.currentTime);
          // 無料試聴のハードキャップ: 再生位置15秒で必ず止まる（巻き戻しての聴き直しは可・先へは進めない）
          if (!warawa && a.currentTime >= 15 && !a.paused) {
            previewDoneRef.current = true;
            try { sessionStorage.setItem("schumann-upsell", "1"); } catch {}
            a.pause();
            setShowUpgrade(true);
          }
        }}
        onLoadedMetadata={(e) => setDur((e.target as HTMLAudioElement).duration)}
      />
    </section>
  );
}

/** メタデータ未取得時のフォールバック表示（5:36） */
const SCHUMANN_FALLBACK_SEC = 336;
