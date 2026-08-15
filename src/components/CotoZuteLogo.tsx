"use client";

import { Titan_One } from "next/font/google";

/**
 * CotoZuteロゴ — フォント総選挙で⑨Titan Oneに決定(2026-08-15ユーザー選定)。
 * 「→」のグリフは極太のTitan Oneに対して細すぎるため、
 * 同じ太さ感の手描きSVG矢印(丸キャップ)を添える。
 */

const titan = Titan_One({ weight: "400", subsets: ["latin"], display: "swap" });

export function CotoZuteLogo({
  size = 22,
  color = "#2CB7DE",
  arrow = true,
}: {
  /** 文字サイズ(px) */
  size?: number;
  color?: string;
  /** 矢印を出すか(ドロワー等は文字だけ) */
  arrow?: boolean;
}) {
  return (
    <span
      className={titan.className}
      style={{ color, fontSize: size, lineHeight: 1, display: "inline-flex", alignItems: "center", gap: size * 0.28 }}
    >
      CotoZute
      {arrow && (
        <svg
          width={size * 1.05}
          height={size * 0.6}
          viewBox="0 0 44 26"
          fill="none"
          stroke={color}
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{ marginTop: size * 0.06 }}
        >
          <path d="M4 13h33" />
          <path d="M26.5 3.5 38.5 13l-12 9.5" />
        </svg>
      )}
    </span>
  );
}
