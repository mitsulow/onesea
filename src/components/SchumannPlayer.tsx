"use client";

import { useEffect, useRef, useState } from "react";
import { SCHUMANN } from "@/lib/config";

/**
 * シューマン音© — Web Audio によるブラウザ内合成（配信帯域ゼロ）。
 * 搬送波 hz×mult を hz で振幅変調。無料は freeSec 秒でフェードアウト。
 */
export function SchumannPlayer() {
  const [playing, setPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  const toggle = () => {
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
      setPlaying(false);
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
      if (ctxRef.current === ctx) {
        ctx.close().catch(() => {});
        ctxRef.current = null;
        setPlaying(false);
      }
    };
    ctxRef.current = ctx;
    setPlaying(true);
  };

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
      <button
        onClick={toggle}
        aria-label={playing ? "停止" : "シューマン音©を試聴"}
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
            ? `再生中 — ${SCHUMANN.freeSec}秒でゆっくり消えます`
            : `ブラウザ内合成。無料ではじめの${SCHUMANN.freeSec}秒だけ試聴できます`}
        </div>
      </div>
    </div>
  );
}
