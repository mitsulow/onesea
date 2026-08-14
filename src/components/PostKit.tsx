"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* eslint-disable @next/next/no-img-element */

/**
 * 投稿カード共通キット（全サービス統一・2026-08-14ユーザー指定）。
 * どれも body 直下に portal で描画する。フィードの content-visibility 層は
 * 「自箱の外の描画を切り落とす」ため、カード内に fixed のモーダルを書くと
 * 投稿の縦幅に閉じ込められるバグになる（実際に起きた）。portal はその外に出る。
 */

/** ⋯ボタン + メニュー（編集/削除/通報）。編集・削除は押せない人には薄グレー表示 */
export function DotsMenu({
  canEdit,
  onEdit,
  onDelete,
  onReport,
}: {
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReport?: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const item = "block w-full px-5 py-2.5 text-center text-[13.5px] font-bold";
  return (
    <>
      <button
        ref={btn}
        onClick={() => {
          if (pos) { setPos(null); return; }
          const r = btn.current!.getBoundingClientRect();
          setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
        }}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full active:bg-[#f0f2f5]"
        aria-label="投稿メニュー"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5a5d61">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[125]" onClick={() => setPos(null)} />
            <div
              className="fixed z-[126] overflow-hidden whitespace-nowrap rounded-2xl border border-[#e8eaed] bg-white py-1 shadow-xl"
              style={{ top: pos.top, right: pos.right }}
            >
              <button
                onClick={() => { if (!canEdit) return; setPos(null); onEdit(); }}
                disabled={!canEdit}
                className={`${item} ${canEdit ? "text-[#1c1e21] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
              >編集</button>
              <div className="mx-3 h-px bg-[#f0f2f5]" />
              <button
                onClick={() => { if (!canEdit) return; setPos(null); onDelete(); }}
                disabled={!canEdit}
                className={`${item} ${canEdit ? "text-[#e0455a] active:bg-[#f0f2f5]" : "cursor-default text-[#c8ccd1]"}`}
              >削除</button>
              {onReport && (
                <>
                  <div className="mx-3 h-px bg-[#f0f2f5]" />
                  <button
                    onClick={() => { setPos(null); onReport(); }}
                    className={`${item} text-[#65676b] active:bg-[#f0f2f5]`}
                  >通報</button>
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

/** 全画面の編集シート。長文でも画面全体で編集できる */
export function EditSheet({
  title = "投稿を編集",
  value,
  onChange,
  onCancel,
  onSave,
  saving = false,
}: {
  title?: string;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return createPortal(
    <div
      data-noswipe
      className="fixed inset-0 z-[130] flex flex-col bg-white"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
    >
      <div className="flex items-center justify-between border-b border-[#f0f2f5] px-4 py-2.5">
        <button onClick={onCancel} className="py-1 pr-3 text-[14px] text-[#65676b]">キャンセル</button>
        <span className="text-[14px] font-bold text-[#1c1e21]">{title}</span>
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="rounded-full px-4 py-1.5 text-[13px] font-extrabold text-white disabled:opacity-40"
          style={{ background: "#0abab5" }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        className="flex-1 resize-none px-4 py-3 text-[15px] leading-relaxed outline-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      />
    </div>,
    document.body
  );
}

/** インスタ式ライトボックス: 写真タップ→黒背景でフル画質。ここで初めて原寸を読む(フィードはサムネのまま) */
export function Lightbox({ urls, start = 0, onClose }: { urls: string[]; start?: number; onClose: () => void }) {
  const [idx, setIdx] = useState(start);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && start > 0) el.scrollLeft = el.clientWidth * start;
  }, [start]);
  return createPortal(
    <div data-noswipe className="fixed inset-0 z-[140] bg-black" onClick={onClose}>
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[16px] text-white"
        style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        ×
      </button>
      <div
        ref={ref}
        className="hide-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / el.clientWidth);
          if (i !== idx) setIdx(i);
        }}
      >
        {urls.map((u, i) => (
          <div key={i} className="flex h-full w-full flex-shrink-0 snap-center items-center justify-center">
            <img src={u} alt="" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <div className="absolute left-0 right-0 flex justify-center gap-[6px]" style={{ bottom: "calc(env(safe-area-inset-bottom) + 22px)" }}>
          {urls.map((_, i) => (
            <span key={i} className="rounded-full" style={{ width: 6, height: 6, background: i === idx ? "#fff" : "rgba(255,255,255,.35)" }} />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
