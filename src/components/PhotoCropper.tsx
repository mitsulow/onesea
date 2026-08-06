"use client";

import { useEffect, useRef, useState } from "react";

/* eslint-disable @next/next/no-img-element */

/**
 * 写真の位置調整・ズーム切り抜き。
 * 枠の中で写真をドラッグして位置を合わせ、スライダーでズーム。
 * 「決定」で枠内を canvas に焼いて WebP で返す（画質は用途サイズまで落とす=パケ死しない）。
 */
export function PhotoCropper({
  file,
  aspect, // 幅/高さ（アバター=1、ヘッダー=2.6など）
  outWidth, // 出力幅px（512 / 1600）
  quality = 0.8,
  title = "位置を調整",
  onDone,
}: {
  file: File;
  aspect: number;
  outWidth: number;
  quality?: number;
  title?: string;
  onDone: (blob: Blob | null) => void;
}) {
  const [url] = useState(() => URL.createObjectURL(file));
  const [img, setImg] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 }); // 中心からのずれ（表示px）
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const im = new Image();
    im.onload = () => setImg({ w: im.width, h: im.height });
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  // 枠サイズ（画面幅に合わせる）
  const frameW = Math.min(340, typeof window !== "undefined" ? window.innerWidth - 48 : 340);
  const frameH = frameW / aspect;

  // cover基準の表示サイズ
  const base = img ? Math.max(frameW / img.w, frameH / img.h) : 1;
  const dispW = img ? img.w * base * scale : 0;
  const dispH = img ? img.h * base * scale : 0;

  const clampOff = (x: number, y: number) => {
    const mx = Math.max(0, (dispW - frameW) / 2);
    const my = Math.max(0, (dispH - frameH) / 2);
    return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
  };

  const start = (cx: number, cy: number) => {
    drag.current = { sx: cx, sy: cy, ox: off.x, oy: off.y };
  };
  const move = (cx: number, cy: number) => {
    if (!drag.current) return;
    setOff(clampOff(drag.current.ox + (cx - drag.current.sx), drag.current.oy + (cy - drag.current.sy)));
  };

  const done = () => {
    if (!img) return onDone(null);
    const outH = Math.round(outWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onDone(null);
    const im = new Image();
    im.onload = () => {
      // 表示座標系 → 元画像座標系
      const ratio = 1 / (base * scale);
      const sx = ((dispW - frameW) / 2 - off.x) * ratio;
      const sy = ((dispH - frameH) / 2 - off.y) * ratio;
      const sw = frameW * ratio;
      const sh = frameH * ratio;
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, outWidth, outH);
      canvas.toBlob((b) => onDone(b), "image/webp", quality);
    };
    im.src = url;
  };

  return (
    <div className="fixed inset-0 z-[97] flex flex-col items-center justify-center bg-black/85 px-6">
      <div className="mb-3 text-[13.5px] font-bold text-white">{title}</div>
      <div
        ref={frameRef}
        className="relative touch-none overflow-hidden bg-[#111]"
        style={{ width: frameW, height: frameH, borderRadius: aspect === 1 ? "50%" : 12, boxShadow: "0 0 0 2px rgba(255,255,255,.7)" }}
        onTouchStart={(e) => start(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => move(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={() => (drag.current = null)}
        onMouseDown={(e) => start(e.clientX, e.clientY)}
        onMouseMove={(e) => e.buttons === 1 && move(e.clientX, e.clientY)}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        {img && (
          <img
            src={url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              width: dispW,
              height: dispH,
              left: (frameW - dispW) / 2 + off.x,
              top: (frameH - dispH) / 2 + off.y,
              maxWidth: "none",
            }}
          />
        )}
      </div>
      <div className="mt-4 flex w-full max-w-[340px] items-center gap-3">
        <span className="text-[16px] text-white/70">🔍</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={scale}
          onChange={(e) => {
            const v = Number(e.target.value);
            setScale(v);
            setOff((o) => clampOff(o.x, o.y));
          }}
          className="flex-1 accent-[#2CB7DE]"
          aria-label="ズーム"
        />
      </div>
      <p className="mt-1.5 text-[11px] text-white/60">ドラッグで位置を動かす・スライダーでズーム</p>
      <div className="mt-4 flex w-full max-w-[340px] gap-2">
        <button onClick={() => onDone(null)} className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white/70">
          やめる
        </button>
        <button
          onClick={done}
          className="flex-1 rounded-xl py-2.5 text-[14px] font-extrabold text-white"
          style={{ background: "#2CB7DE" }}
        >
          この位置で決定
        </button>
      </div>
    </div>
  );
}
