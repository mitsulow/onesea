"use client";

import { Baloo_2 } from "next/font/google";

/**
 * CotoZuteロゴ — 総選挙⑨Titan Oneは「太すぎる」となり(2026-09-01ユーザー指示)、
 * 同じ丸ゴ系で一段軽いBaloo 2(700)へ変更。
 * 「→」のグリフはロゴ文字に対して細すぎるため、
 * 同じ太さ感の手描きSVG矢印(丸キャップ)を添える(太さはフォントと連動して調整)。
 */

const balo = Baloo_2({ weight: "700", subsets: ["latin"], display: "swap" });

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
      className={balo.className}
      style={{ color, fontSize: size, lineHeight: 1, display: "inline-flex", alignItems: "center", gap: size * 0.12 }}
    >
      CotoZute
      {arrow && (
        <svg
          width={size * 1.05}
          height={size * 0.6}
          viewBox="0 0 44 26"
          fill="none"
          stroke={color}
          strokeWidth="6.5"
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
