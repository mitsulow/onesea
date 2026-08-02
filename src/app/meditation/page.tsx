"use client";

/**
 * 瞑想モード（音響β）— 検証UI付き
 * 音響仕様書準拠のバイノーラル・セッション。イヤホン/ヘッドホン専用。
 * 画面はいま何が起きているかの確認用（区間・残り時間・帯グラフ・8本の音量とHiの耳）。
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SCHUMANN_DATA_URL } from "@/lib/config";
import {
  BRAIN_MODES,
  MED_DEFAULTS,
  type MedConfig,
  type MedSession,
  type MedTimeline,
  buildTimeline,
  envAt,
  fetchMeasuredModes,
  hiSideAt,
  startMedSession,
  TEXTBOOK_MODES,
} from "@/lib/meditationAudio";

/** 各モードの幻の基音の説明（帯域） */
const MODE_NOTES: Record<string, string> = {
  γ: "基音≈41.6Hz・最小整数比 6:11:16:21:31",
  β: "基音≈20.8Hz・22:32:33:47:62",
  α: "基音≈10.4Hz・44:64:65:84:94",
  θ: "基音≈7.83Hz(F1)・85:86:112:125:164",
  δ: "基音≈1.3Hz・352:512:517:672:752",
};

// v2: 初期値を大きく変えたため保存キーを更新（古い設定を引き継がない）
const CFG_KEY = "onesea-med-cfg2";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MeditationPage() {
  const [cfg, setCfg] = useState<MedConfig>(MED_DEFAULTS);
  const [modes, setModes] = useState<number[]>(TEXTBOOK_MODES);
  const [modeSrc, setModeSrc] = useState<"live" | "cached" | "textbook">("textbook");
  const [session, setSession] = useState<MedSession | null>(null);
  const [showCfg, setShowCfg] = useState(false);
  const [now, setNow] = useState(0); // セッション相対秒（表示専用）
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const rafRef = useRef<number>(0);

  /* 設定の読み書き */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CFG_KEY);
      if (saved) setCfg({ ...MED_DEFAULTS, ...JSON.parse(saved) });
    } catch {}
  }, []);
  const patchCfg = (p: Partial<MedConfig>) => {
    setCfg((c) => {
      const next = { ...c, ...p };
      try {
        localStorage.setItem(CFG_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  /* 実測シューマン（キャリアのみ実測。Δfは固定） */
  useEffect(() => {
    fetchMeasuredModes(SCHUMANN_DATA_URL).then((r) => {
      setModes(r.modes);
      setModeSrc(r.source);
    });
  }, []);

  /* 表示の時計（UIだけ。音はすべてAudioContextに予約済みで、画面が消えても進む） */
  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const t = session.ctx.currentTime - session.t0;
      setNow(t);
      if (t > session.timeline.total + 1) {
        stopSession();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const begin = () => {
    if (session) return;
    const tl: MedTimeline = buildTimeline(cfg, modes);
    const s = startMedSession(cfg, tl);
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

  const tl = session?.timeline ?? null;
  const sec = tl?.sections.find((s) => now >= s.start && now < s.end) ?? null;
  const total = tl?.total ?? 0;

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#0b1020] px-4 pb-16 pt-5 text-white">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/mmm" className="text-[13px] text-white/60 no-underline">
          ← MasterMind
        </Link>
        <span className="text-[15px] font-extrabold tracking-widest">瞑想モード 音響β</span>
        <button onClick={() => setShowCfg((v) => !v)} className="text-[13px] text-white/60">
          ⚙︎
        </button>
      </div>

      {/* キャリアの出どころ */}
      <div className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/70">
        キャリア（実測シューマン第1〜4モード）:{" "}
        <span className="num font-bold text-white/90">{modes.map((m) => m.toFixed(2)).join(" / ")} Hz</span>
        <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">
          {modeSrc === "live" ? "実測" : modeSrc === "cached" ? "前回の実測" : "教科書値"}
        </span>
        <div className="mt-0.5 text-white/45">左右差は 8.0219032748 Hz 固定（脳に届く数字はこれだけ）</div>
      </div>

      {!session ? (
        <>
          {/* イヤホン専用の案内（スピーカーでは左右が空気中で混ざりバイノーラルビートは消える） */}
          <div className="mb-4 rounded-2xl border border-[#d4b96a]/40 bg-[#d4b96a]/10 p-4 text-center">
            <div className="text-[34px]">🎧</div>
            <div className="mt-1 text-[14px] font-extrabold">イヤホン・ヘッドホン専用です</div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-white/70">
              左右の耳にわずかに違う周波数を届け、その差 8.02Hz を脳に作らせます。
              スピーカーでは左右の音が混ざり、効果が完全に消えます。
            </div>
          </div>
          {/* 脳波モード選択（指定なし=毎回ランダム） */}
          <div className="mb-3 rounded-2xl bg-white/5 p-3">
            <div className="mb-2 text-[11.5px] font-bold text-white/70">脳波モード（幻の基音の帯域）</div>
            <div className="flex gap-1.5">
              {["random", ...BRAIN_MODES].map((m) => (
                <button
                  key={m}
                  onClick={() => patchCfg({ brainMode: m })}
                  className="flex-1 rounded-xl border py-2.5 text-[15px] font-extrabold"
                  style={
                    cfg.brainMode === m
                      ? { background: "#d4b96a", borderColor: "#d4b96a", color: "#0b1020" }
                      : { background: "transparent", borderColor: "rgba(255,255,255,.18)", color: "rgba(255,255,255,.65)" }
                  }
                >
                  {m === "random" ? "🎲" : m}
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[9.5px] leading-relaxed text-white/40">
              {cfg.brainMode === "random"
                ? "🎲 = おまかせ（毎回どれかが選ばれる。どれだったかは再生中に表示）"
                : MODE_NOTES[cfg.brainMode]}
            </div>
          </div>
          <button
            onClick={begin}
            className="w-full rounded-2xl py-4 text-[16px] font-extrabold text-[#0b1020]"
            style={{ background: "linear-gradient(120deg,#e8dcae,#d4b96a)" }}
          >
            イヤホンを着けた — はじめる（約{fmt(250 + cfg.dwell * 2.6)}）
          </button>
          <div className="mt-2 text-center text-[10.5px] text-white/40">
            第1音とともに始まりの鐘3打。5つの音が高い方から現れ、終わりの鐘3打のあと1本ずつ帰っていきます
          </div>
        </>
      ) : (
        <>
          {/* いまの区間と残り時間 */}
          <div className="rounded-2xl bg-white/5 p-4 text-center">
            <div className="text-[13px] font-bold text-white/80">
              {sec ? sec.name : "おわり"}
              {sec?.side && (
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                  style={{
                    background: sec.side === "移行中" ? "rgba(212,185,106,.2)" : "rgba(96,165,250,.18)",
                    color: sec.side === "移行中" ? "#e8dcae" : "#9cc4f8",
                  }}
                >
                  {sec.side}
                </span>
              )}
            </div>
            <div className="num mt-1 text-[44px] font-extrabold leading-none">
              {fmt(sec ? sec.end - now : 0)}
            </div>
            <div className="mt-1 text-[10.5px] text-white/45">次の切り替えまで ・ 全体 {fmt(Math.max(0, total - now))}</div>
            {tl && (
              <div className="mt-1.5 text-[11px] font-bold" style={{ color: "#e8dcae" }}>
                {tl.mode}モード ・ 幻の基音 {tl.baseHz.toFixed(2)}Hz
              </div>
            )}
          </div>

          {/* セッション全体の帯グラフ */}
          {tl && (
            <div className="mt-3">
              <div className="relative flex h-6 w-full overflow-hidden rounded-lg">
                {tl.sections.map((s, i) => (
                  <div
                    key={i}
                    className="h-full border-r border-[#0b1020] last:border-r-0"
                    style={{
                      width: `${((s.end - s.start) / total) * 100}%`,
                      background:
                        s.side === "移行中"
                          ? "rgba(212,185,106,.35)"
                          : s.name === "終わりの鐘"
                            ? "rgba(232,220,174,.5)"
                            : s.name === "登場" || s.name === "退場"
                              ? "rgba(255,255,255,.10)"
                              : s.side === "左脳優位"
                                ? "rgba(129,140,248,.30)"
                                : "rgba(96,165,250,.22)",
                    }}
                  />
                ))}
                <div
                  className="absolute top-0 h-full w-[2px] bg-[#e8dcae]"
                  style={{ left: `${Math.min(100, (now / total) * 100)}%` }}
                />
              </div>
              <div className="relative mt-0.5 h-4 w-full text-[9px] text-white/40">
                {tl.sections.slice(1).map((s, i) => (
                  <span key={i} className="num absolute -translate-x-1/2" style={{ left: `${(s.start / total) * 100}%` }}>
                    {fmt(s.start)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 8本の音: 現在音量と Hi の耳 */}
          {tl && (
            <div className="mt-3 space-y-1.5 rounded-2xl bg-white/5 p-3">
              {tl.voices.map((vt) => {
                const e = envAt(vt, cfg, now);
                const side = hiSideAt(vt, cfg, now);
                return (
                  <div key={vt.spec.ix} className="flex items-center gap-2 text-[10.5px]">
                    <span className="num w-[52px] flex-shrink-0 text-white/70">{vt.spec.name}</span>
                    <span className="num w-[62px] flex-shrink-0 text-white/40">{vt.spec.freq.toFixed(1)}Hz</span>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(e * 100)}%`,
                          background: e < 0.15 ? "#d4b96a" : "#60a5fa",
                          transition: "width .2s linear",
                        }}
                      />
                    </div>
                    <span
                      className="num w-[30px] flex-shrink-0 text-center font-extrabold"
                      style={{ color: side === "L" ? "#9cc4f8" : "#f0a8c0" }}
                    >
                      {vt.spec.freq + 8.02 < 1000 ? `Hi${side}` : "－"}
                    </span>
                  </div>
                );
              })}
              <div className="pt-0.5 text-[9px] leading-relaxed text-white/35">
                Hiの耳が左=右脳優位 / 右=左脳優位。－は1kHz超（バイノーラル不成立・音色の飾り）
              </div>
            </div>
          )}

          <button
            onClick={stopSession}
            className="mt-4 w-full rounded-2xl border border-white/20 py-3 text-[14px] font-bold text-white/80"
          >
            ■ 終了する
          </button>
        </>
      )}

      {/* 設定（すべて仕様書の初期値。聴きながら詰める） */}
      {showCfg && !session && (
        <div className="mt-4 space-y-2 rounded-2xl bg-white/5 p-3 text-[12px]">
          <div className="mb-1 font-extrabold text-white/80">設定（次のセッションから反映）</div>
          {(
            [
              ["dwell", "滞在時間（秒）", 30, 900, 10],
              ["master", "全体の音量", 0.01, 0.4, 0.01],
              ["flutterDepth", "ゆらぎの深さ", 0, 0.8, 0.05],
              ["basePeriod", "ゆらぎ基準周期（秒）", 30, 300, 10],
              ["breathDepth", "呼吸スウェルの深さ", 0, 0.3, 0.02],
              ["breathPeriod", "呼吸の周期（秒）", 8, 20, 1],
              ["echoMix", "φエコーの量", 0, 0.4, 0.02],
              ["isoDepth", "同相AM補強（ブツブツ源・通常0）", 0, 0.3, 0.02],
              ["hfExp", "高域を抑える指数", 0, 1, 0.05],
              ["enterGap", "登場の間隔（秒）", 2, 15, 1],
              ["enterRise", "立ち上がり（秒）", 4, 30, 1],
              ["panGap", "PANの間隔（秒）", 3, 12, 1],
              ["panDip", "PANの沈み・片道（秒）", 1, 6, 0.5],
              ["exitGap", "退場の間隔（秒）", 2, 15, 1],
              ["exitTail", "退場の余韻（秒）", 5, 40, 1],
            ] as Array<[keyof MedConfig, string, number, number, number]>
          ).map(([key, label, min, max, step]) => (
            <label key={key} className="flex items-center justify-between gap-2">
              <span className="text-white/65">{label}</span>
              <span className="flex items-center gap-2">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={Number(cfg[key])}
                  onChange={(e) => patchCfg({ [key]: Number(e.target.value) } as Partial<MedConfig>)}
                  className="w-28 accent-[#d4b96a]"
                />
                <span className="num w-11 text-right text-white/85">{Number(cfg[key])}</span>
              </span>
            </label>
          ))}
          <label className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <span className="text-white/65">
              純正律スナップ
              <span className="block text-[9.5px] text-white/35">
                5音を実測F3の22/32/33/47/62倍に。差音が全てF3の整数倍になり立体に融合
              </span>
            </span>
            <input
              type="checkbox"
              checked={cfg.justOn}
              onChange={(e) => patchCfg({ justOn: e.target.checked })}
              className="h-5 w-5 accent-[#d4b96a]"
            />
          </label>
          <button
            onClick={() => {
              try {
                localStorage.removeItem(CFG_KEY);
              } catch {}
              setCfg(MED_DEFAULTS);
            }}
            className="mt-1 w-full rounded-lg border border-white/15 py-1.5 text-[11px] text-white/55"
          >
            初期値に戻す
          </button>
        </div>
      )}
    </main>
  );
}
