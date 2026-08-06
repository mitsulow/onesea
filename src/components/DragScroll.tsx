"use client";

import { useRef } from "react";

/**
 * 横スクロール領域を「マウスのドラッグ」でも動かせるようにするラッパー。
 * タッチ端末はスワイプ、PC(タッチ非対応)はつかんで左右に引ける。
 * ドラッグ後の誤クリック（カードが開いてしまう）は onClickCapture で抑止する。
 */
export function DragScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const st = useRef({ down: false, sx: 0, sl: 0, moved: false });

  return (
    <div
      ref={ref}
      className={className}
      style={{ cursor: "grab" }}
      onMouseDown={(e) => {
        const el = ref.current;
        if (!el) return;
        st.current = { down: true, sx: e.pageX, sl: el.scrollLeft, moved: false };
      }}
      onMouseMove={(e) => {
        if (!st.current.down || !ref.current) return;
        const dx = e.pageX - st.current.sx;
        if (Math.abs(dx) > 3) st.current.moved = true;
        ref.current.scrollLeft = st.current.sl - dx;
      }}
      onMouseUp={() => { st.current.down = false; }}
      onMouseLeave={() => { st.current.down = false; }}
      onClickCapture={(e) => {
        if (st.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          st.current.moved = false;
        }
      }}
    >
      {children}
    </div>
  );
}
