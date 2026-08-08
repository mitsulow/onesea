"use client";

/**
 * 瞑想モード 音響α版 — MMMの「瞑想モード」はじめる から立ち上がる全画面ページ。
 *
 * 流れ: 実録シューマン音(約5分) → 鐘3回 → 「無音」or「機械生成周波数」 → 時間が来たら終わりの鐘3回
 *
 * 機械生成周波数は5種類:
 * - φ: その瞬間の実測F1 × φ⁸ を真ん中の音に、その 3倍音・5倍音・1/3音・1/5音 の5本で組む
 * - α/β/γ/θ: 実測シューマンを最小整数比にスナップした5音(メイン瞑想エンジンと同じ組)
 * どちらも左右の耳で 8.0219032748 Hz だけ周波数をズラす(バイノーラル)。
 * 音響イベントは全て AudioContext の時刻で予約(画面が消えても進む)。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SCHUMANN_DATA_URL } from "@/lib/config";
import { MED_DEFAULTS, TEXTBOOK_MODES, buildVoices, fetchMeasuredModes, type BrainMode } from "@/lib/meditationAudio";

const PHI = 1.6180339887498949;
const DELTA = 8.0219032748; // 左右差(固定)
const MINUTES = [10, 15, 20, 25, 30] as const;
const GEN_KINDS = ["φ", "α", "β", "γ", "θ"] as const;
const SCHU = 336; // 実録シューマン音の長さ(秒・約5分36秒)
/** 各モードの5音の整数比(φは 1/5:1/3:1:3:5 を15倍した整数比) */
const GEN_RATIOS: Record<string, string> = {
  "φ": "3:5:15:45:75",
  "α": "44:64:65:84:94",
  "β": "22:32:33:47:62",
  "γ": "6:11:16:21:31",
  "θ": "85:86:112:125:164",
};
type GenKind = (typeof GEN_KINDS)[number];

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 鐘1打(実測F1×64Hz の倍音クラスタ・約7秒の余韻) */
function bellStrike(ctx: AudioContext, dest: AudioNode, when: number, f0: number) {
  const partials: Array<[number, number]> = [
    [1, 1],
    [2.0, 0.55],
    [2.98, 0.35],
    [4.2, 0.2],
  ];
  for (const [r, a] of partials) {
    const o = ctx.createOscillator();
    o.frequency.value = f0 * r;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.16 * a, when + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 7);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + 7.5);
  }
}

interface AlphaSession {
  ctx: AudioContext;
  t0: number; // セッション開始のctx時刻
  total: number; // 秒
  genLabel: string | null;
  modeLabel: string;
  stop: () => void;
  midBellAt: { v: number | null }; // シューマン音が終わった実時刻(相対秒・進行表示用)
}

export default function MeditationAlphaPage() {
  const [mins, setMins] = useState<number>(15);
  const [kind, setKind] = useState<"silence" | "gen" | "repeat" | null>(null);
  const [gen, setGen] = useState<GenKind>("φ");
  const [modes, setModes] = useState<number[]>(TEXTBOOK_MODES);
  const [modeSrc, setModeSrc] = useState<"live" | "cached" | "textbook">("textbook");
  const [session, setSession] = useState<AlphaSession | null>(null);
  const [now, setNow] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    fetchMeasuredModes(SCHUMANN_DATA_URL).then((r) => {
      setModes(r.modes);
      setModeSrc(r.source);
    });
  }, []);

  /* 表示の時計(UIのみ。音はすべて予約済み) */
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const t = session.ctx.currentTime - session.t0;
      setNow(t);
      if (t > session.total + 26) {
        stopSession();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /** 5音の周波数と音量(φ or 整数比モード) */
  const genFreqs = (): Array<{ f: number; v: number }> => {
    if (gen === "φ") {
      const c = modes[0] * Math.pow(PHI, 8); // F1×φ⁸ ≈ 368Hz(可聴域なのでオクターブ調整不要)
      const list = [c / 5, c / 3, c, c * 3, c * 5];
      return list.map((f, ix) => ({ f, v: Math.pow(PHI, -ix / 2) }));
    }
    const vs = buildVoices({ ...MED_DEFAULTS, justOn: true }, modes, gen as BrainMode);
    return vs.map((v) => ({ f: v.freq, v: v.vol }));
  };

  const begin = () => {
    if (session || !kind) return;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    // 画面が消えてもctxを止めないための極小キャリア(聞こえない)
    const keep = ctx.createOscillator();
    keep.frequency.value = 45;
    const keepG = ctx.createGain();
    keepG.gain.value = 0.0001;
    keep.connect(keepG);
    keepG.connect(master);
    keep.start();

    const t0 = ctx.currentTime;
    const total = mins * 60;
    const bellF = modes[0] * 64; // ≈501Hz

    // 終わりの鐘3回は「設定した時間」に絶対時刻で予約(無音瞑想でも必ず鳴る)
    bellStrike(ctx, master, t0 + total, bellF);
    bellStrike(ctx, master, t0 + total + 8, bellF);
    bellStrike(ctx, master, t0 + total + 16, bellF);

    const midBellAt = { v: null as number | null };

    // 実録シューマン音(約5分)。終わったら鐘3回 → 選んだ過ごし方へ
    const el = new Audio("/audio/schumann_r8_geshi.mp3");
    el.preload = "auto";
    audioRef.current = el;
    // リピート: 瞑想時間内に何回流せるかを整数で計算し、あまりの時間は無音
    const repeats = kind === "repeat" ? Math.max(1, Math.floor(total / SCHU)) : 1;
    let played = 1;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      const t = ctx.currentTime + 0.4;
      midBellAt.v = t - t0;
      bellStrike(ctx, master, t, bellF);
      bellStrike(ctx, master, t + 8, bellF);
      bellStrike(ctx, master, t + 16, bellF);
      if (kind === "gen") {
        // 鐘3打のあと、5本の音が低い方から順に立ち上がる
        const at = t + 22;
        const endAt = t0 + total; // 終わりの鐘と同時に消えている
        if (at < endAt - 20) {
          const merger = ctx.createChannelMerger(2);
          merger.connect(master);
          genFreqs().forEach(({ f, v }, ix) => {
            ([[0, f], [1, f + DELTA]] as Array<[number, number]>).forEach(([ch, ff]) => {
              const o = ctx.createOscillator();
              o.frequency.value = ff;
              const g = ctx.createGain();
              const peak = Math.max(0.0002, v * 0.055);
              g.gain.setValueAtTime(0.0001, at);
              g.gain.exponentialRampToValueAtTime(peak, at + 14 + ix * 6);
              g.gain.setValueAtTime(peak, endAt - 12);
              g.gain.exponentialRampToValueAtTime(0.0001, endAt - 1);
              o.connect(g);
              g.connect(merger, 0, ch);
              o.start(at);
              o.stop(endAt);
            });
          });
        }
      }
    };
    el.addEventListener("ended", () => {
      if (kind === "repeat" && played < repeats) {
        played += 1;
        el.currentTime = 0;
        void el.play().catch(() => advance());
      } else {
        advance();
      }
    });
    // 万一mp3が読めない環境でも瞑想が始まらないのが最悪 → 6分で強制的に次へ
    el.addEventListener("error", () => setTimeout(advance, 1000));
    const guard = window.setTimeout(advance, repeats * 6 * 60 * 1000);
    void el.play().catch(() => advance());

    const stop = () => {
      window.clearTimeout(guard);
      try {
        el.pause();
        el.src = "";
      } catch {}
      try {
        void ctx.close();
      } catch {}
    };

    const s: AlphaSession = {
      ctx,
      t0,
      total,
      genLabel: kind === "gen" ? gen : null,
      modeLabel:
        kind === "gen"
          ? `機械生成周波数: ${gen}`
          : kind === "repeat"
            ? `シューマン音リピート(${repeats}回)`
            : "無音瞑想",
      stop,
      midBellAt,
    };
    setSession(s);
    setNow(0);
    navigator.wakeLock
      ?.request("screen")
      .then((w) => (wakeRef.current = w))
      .catch(() => {});
  };

  const stopSession = () => {
    session?.stop();
    setSession(null);
    setNow(0);
    wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  };

  useEffect(() => () => stopSession(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* いまの区間名 */
  const phaseName = (): string => {
    if (!session) return "";
    const mid = session.midBellAt.v;
    if (now >= session.total + 0.5) return "終わりの鐘";
    if (mid == null) return "地球の音(実録シューマン)";
    if (now < mid + 22) return "鐘";
    return session.genLabel ? `機械生成周波数(${session.genLabel})で瞑想` : "無音で瞑想";
  };

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 pb-16 pt-5 text-white" style={{ background: "#0abab5" }}>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/mmm" className="text-[13px] text-white/85 no-underline">
          ← MasterMind
        </Link>
        <span className="text-[15px] font-extrabold tracking-widest">瞑想モード音響α版</span>
        <span className="w-8" />
      </div>

      {!session ? (
        <>
          {/* イヤホン専用の案内 */}
          <div className="mb-4 rounded-2xl border border-white/40 bg-white/15 p-4 text-center">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-headphone.webp" alt="" style={{ width: 38, height: 38 }} />
            </div>
            <div className="mt-1 text-[14px] font-extrabold">イヤホン・ヘッドホン専用です</div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-white/90">
              「周波数自動生成」部分のみ左右で周波数が8.0219Hz異なります。
              そのためスピーカーだと左右の音が混ざり、効果が完全に消えます。
            </div>
          </div>

          {/* ① 分数 */}
          <div className="mb-3 rounded-2xl bg-white/20 p-3">
            <div className="mb-2 text-[11.5px] font-bold text-white/90">① 瞑想時間を選ぶ</div>
            <div className="flex gap-1.5">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  onClick={() => setMins(m)}
                  className="flex-1 rounded-xl border py-2.5 text-[14px] font-extrabold"
                  style={
                    mins === m
                      ? { background: "#fff", borderColor: "#fff", color: "#0a8a84" }
                      : { background: "rgba(255,255,255,.10)", borderColor: "rgba(255,255,255,.45)", color: "rgba(255,255,255,.92)" }
                  }
                >
                  {m}分
                </button>
              ))}
            </div>
          </div>

          {/* ② 無音 or 機械生成周波数 */}
          <div className="mb-3 rounded-2xl bg-white/20 p-3">
            <div className="mb-2 text-[11.5px] font-bold text-white/90">② シューマン音視聴後</div>
            <div className="flex gap-1.5">
              {(
                [
                  ["silence", "無音"],
                  ["gen", "機械生成周波数"],
                  ["repeat", "リピート"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className="flex-1 rounded-xl border py-3 text-[14px] font-extrabold"
                  style={
                    kind === k
                      ? { background: "#fff", borderColor: "#fff", color: "#0a8a84" }
                      : { background: "rgba(255,255,255,.10)", borderColor: "rgba(255,255,255,.45)", color: "rgba(255,255,255,.92)" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10.5px] leading-relaxed text-white/85">
              約5分間のシューマン音が鳴った後に、鐘が3回鳴ります。
              その後の部分を「無音」で瞑想するか「機械生成周波数」で瞑想するかを選択できます。
              設定した時間が来ると終わりの鐘が3回鳴ります。
            </div>
            {kind === "repeat" && (
              <div className="mt-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-[10.5px] font-bold leading-relaxed text-white">
                {mins}分だとシューマン音(約5分36秒)が{Math.max(1, Math.floor((mins * 60) / SCHU))}回流れ、
                残り{fmt(mins * 60 - Math.max(1, Math.floor((mins * 60) / SCHU)) * SCHU)}は無音になります
              </div>
            )}
            <div className="mt-1.5 border-t border-white/25 pt-1.5 text-[10.5px] leading-relaxed text-white/85">
              シューマン音の後の瞑想におススメは「地球のナチュラルな音（無音）」ですが、
              周囲がうるさい環境などには「機械生成音」をお使いください。
              シューマン音をリピートしてお聴きになる事も可能です。
            </div>
          </div>

          {/* 機械生成周波数: 5種類 */}
          {kind === "gen" && (
            <div className="mb-3 rounded-2xl bg-white/20 p-3">
              <div className="mb-2 text-[11.5px] font-bold text-white/90">周波数の種類</div>
              <div className="flex gap-1.5">
                {GEN_KINDS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setGen(k)}
                    className="min-w-0 flex-1 rounded-xl border px-0.5 py-2 text-[15px] font-extrabold"
                    style={
                      gen === k
                        ? { background: "#fff", borderColor: "#fff", color: "#0a8a84" }
                        : { background: "rgba(255,255,255,.10)", borderColor: "rgba(255,255,255,.45)", color: "rgba(255,255,255,.92)" }
                    }
                  >
                    <span className="block leading-none">{k}</span>
                    <span className="num mt-1 block break-all text-[7.5px] font-bold leading-tight tracking-tight opacity-80">
                      {GEN_RATIOS[k]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-[9.5px] leading-relaxed text-white/80">
                {gen === "φ"
                  ? `その瞬間の実測F1(${modes[0].toFixed(2)}Hz)×φ⁸=${(modes[0] * Math.pow(PHI, 8)).toFixed(1)}Hzを真ん中に、3倍音・5倍音・1/3音・1/5音の5本`
                  : `実測シューマンを整数比 ${GEN_RATIOS[gen]} にスナップした5音(${gen}帯域)`}
                ・左右差 8.0219032748Hz
                <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[9px]">
                  {modeSrc === "live" ? "実測" : modeSrc === "cached" ? "前回の実測" : "教科書値"}
                </span>
              </div>
            </div>
          )}

          {kind && (
            <button
              onClick={begin}
              className="w-full rounded-2xl bg-white py-4 text-[16px] font-extrabold text-[#0a8a84]"
            >
              瞑想を始める（{mins}分）
            </button>
          )}
        </>
      ) : (
        <>
          <div className="rounded-2xl bg-white/20 p-4 text-center">
            <div className="text-[13px] font-bold text-white/80">{phaseName()}</div>
            <div className="num mt-1 text-[44px] font-extrabold leading-none">{fmt(Math.max(0, session.total - now))}</div>
            <div className="mt-1 text-[10.5px] text-white/80">
              {session.modeLabel} ・ 全体 {session.total / 60}分
            </div>
          </div>
          <button
            onClick={stopSession}
            className="mt-4 w-full rounded-2xl border border-white/50 py-3 text-[14px] font-bold text-white"
          >
            ■ 終了する
          </button>
        </>
      )}
    </main>
  );
}
