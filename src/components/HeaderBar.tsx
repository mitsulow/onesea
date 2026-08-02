"use client";

import { AvatarMenu } from "./AvatarMenu";

/** ヒーロー: 中央にOneSeaロゴ、右上アバター=全サービスメニュー */
export function HeaderBar() {
  return (
    <header
      className="relative z-[60] flex items-center justify-center px-5 py-2"
      style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
    >
      <h1
        className="rounded-full border px-4 py-[3px]"
        style={{
          borderColor: "rgba(212,185,106,.65)",
          boxShadow: "0 0 12px rgba(212,185,106,.3), inset 0 0 10px rgba(212,185,106,.14)",
        }}
      >
        <span className="flex items-center gap-2 leading-none">
          <svg width="15" height="15" viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="82" r="56" fill="none" stroke="#D4B96A" strokeWidth="14" />
            <path
              d="M20 150 Q 50 132 80 150 T 140 150 T 200 150"
              fill="none"
              stroke="#7AB8D8"
              strokeWidth="14"
              strokeLinecap="round"
            />
          </svg>
          <span
            className="text-[11.5px] font-bold text-[#e8d5a0]"
            style={{ letterSpacing: 3, fontFamily: '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif' }}
          >
            地球アプリ
          </span>
          <span
            className="text-[16px] font-semibold"
            style={{
              fontFamily: '"Cormorant Garamond", "Georgia", "Times New Roman", serif',
              letterSpacing: 2.5,
              background: "linear-gradient(120deg,#f6e9c4,#d4b96a 55%,#f0e6c8)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 0 18px rgba(212,185,106,.35)",
            }}
          >
            OneSea
          </span>
        </span>
      </h1>
      <span className="absolute right-4 top-1/2 -translate-y-1/2">
        <AvatarMenu />
      </span>
    </header>
  );
}
