"use client";

import { useEffect, useState } from "react";

const TRIGGER = 220; // これだけしっかり引っ張ったらリロード（軽い誤爆を防ぐ）
const SHOW_FROM = 70;

/**
 * しっかり長めの下スワイプでページ再読み込み。
 * ブラウザ標準の pull-to-refresh は軽すぎて誤発動するため無効化し、
 * 強め（220px）に引っ張った時だけ再読み込みする。
 * [data-no-pull] の中（手帳のボトムシート等）では発動しない。
 */
export function PullToReload() {
  const [dist, setDist] = useState(0);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    let startY: number | null = null;

    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-pull]")) {
        startY = null;
        return;
      }
      startY = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY == null) return;
      if (window.scrollY > 0) {
        startY = null;
        setDist(0);
        return;
      }
      const d = e.touches[0].clientY - startY;
      setDist(d > 0 ? d : 0);
    };
    const onEnd = () => {
      setDist((d) => {
        if (d >= TRIGGER) {
          setReloading(true);
          setTimeout(() => window.location.reload(), 150);
          return d;
        }
        return 0;
      });
      startY = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  if (dist < SHOW_FROM && !reloading) return null;
  const ready = dist >= TRIGGER;
  const progress = Math.min(dist / TRIGGER, 1);

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[90] -translate-x-1/2"
      style={{ top: 14 + Math.min(dist / 5, 34) }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-lg"
        style={{
          transform: `rotate(${progress * 360}deg)`,
          color: ready ? "#3e9b6c" : "#b0a898",
          opacity: reloading ? 1 : 0.5 + progress * 0.5,
        }}
      >
        {reloading ? "⟳" : ready ? "⟳" : "↓"}
      </div>
    </div>
  );
}
