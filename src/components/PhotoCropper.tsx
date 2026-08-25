"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/* eslint-disable @next/next/no-img-element */

/**
 * 写真の位置調整・ズーム切り抜き（わらわ〜ボランティアのImageCropper方式を移植）。
 * 枠の中で写真をドラッグして位置を合わせ、スライダー or 2本指ピンチでズーム。
 * 「決定」で枠内を canvas に焼いて WebP で返す（画質は用途サイズまで落とす=パケ死しない）。
 * オーバーレイUIの掟に従い createPortal で body 直下に描画（祖先の閉じ込め対策）。
 */
export function PhotoCropper({
  file,
  aspect, // 幅/高さ（アバター=1、ヘッダー=2.4など）
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
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

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

  // ポインターイベント（iPhone/Android/PC共通）。2本指=ピンチズーム・1本指=ドラッグ移動
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), s: scale };
      drag.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const next = Math.min(4, Math.max(1, (pinch.current.s * d) / pinch.current.d));
      setScale(next);
      setOff((o) => clampOff(o.x, o.y));
      return;
    }
    if (drag.current) {
      setOff(clampOff(drag.current.ox + (e.clientX - drag.current.sx), drag.current.oy + (e.clientY - drag.current.sy)));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) drag.current = null;
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

  const body = (
    <div data-noswipe className="fixed inset-0 z-[160] flex flex-col items-center justify-center bg-black/85 px-6">
      <div className="mb-3 text-[13.5px] font-bold text-white">{title}</div>
      <div
        ref={frameRef}
        className="relative touch-none select-none overflow-hidden bg-[#111]"
        style={{ width: frameW, height: frameH, borderRadius: aspect === 1 ? "50%" : 12, boxShadow: "0 0 0 2px rgba(255,255,255,.7)" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
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
        <img src="/icons/icon-search.webp" alt="" style={{ width: 18, height: 18 }} />
        <input
          type="range"
          min={1}
          max={4}
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
      <p className="mt-1.5 text-[11px] text-white/60">ドラッグで位置・スライダー（または2本指）でズーム</p>
      <div className="mt-4 flex w-full max-w-[340px] gap-2">
        <button onClick={() => onDone(null)} className="rounded-xl px-4 py-2.5 text-[13px] font-bold text-white/70">
          キャンセル
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

  // SSRでは描画されない（fileが選ばれた後にしかマウントされない）のでdocument直参照でOK
  return typeof document !== "undefined" ? createPortal(body, document.body) : body;
}

/**
 * アイコン/背景アップロードの共通クロッパーフック。
 * 使い方:
 *   const crop = useImageCrop();
 *   <input type="file" onChange={(e) => { crop.open(e.target.files?.[0] ?? null, "icon", (f) => changeImage("icon", f)); e.currentTarget.value = ""; }} />
 *   {crop.element}
 * kind: icon=丸1:1(512) / cover=FBページ型背景2.4:1(1600) / wide=カード見出し16:9(1280)
 * 切り抜いたWebPをFileで返すので、既存の uploadImage / changeImage パイプラインにそのまま流せる。
 */
export type CropKind = "icon" | "cover" | "wide";
const CROP_PRESET: Record<CropKind, { aspect: number; outWidth: number; title: string }> = {
  icon: { aspect: 1, outWidth: 512, title: "アイコンの位置と大きさを調整" },
  cover: { aspect: 2.4, outWidth: 1600, title: "背景写真の位置と大きさを調整" },
  wide: { aspect: 16 / 9, outWidth: 1280, title: "写真の位置と大きさを調整" },
};

export function useImageCrop() {
  const [state, setState] = useState<{ file: File; kind: CropKind; cb: (f: File | null) => void } | null>(null);

  const open = (file: File | null | undefined, kind: CropKind, cb: (f: File | null) => void) => {
    if (!file) return;
    setState({ file, kind, cb });
  };

  const element: ReactNode = state ? (
    <PhotoCropper
      file={state.file}
      aspect={CROP_PRESET[state.kind].aspect}
      outWidth={CROP_PRESET[state.kind].outWidth}
      title={CROP_PRESET[state.kind].title}
      onDone={(blob) => {
        const cb = state.cb;
        setState(null);
        if (!blob) return; // キャンセル
        cb(new File([blob], "crop.webp", { type: "image/webp" }));
      }}
    />
  ) : null;

  return { open, element, active: !!state };
}
