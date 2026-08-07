"use client";

import { useEffect } from "react";

/**
 * ページ最上部の「色の継ぎ目」を消す共通部品。
 * body の背景（= セーフエリア/上部インセットの色）と theme-color メタを
 * ヘッダーと同じ色に塗り、離脱時に元へ戻す。
 * これが無いページは body 既定色(紺)や前ページの色が上に残り、
 * ヘッダーの上に「白い線/別色の線」が見える。(Cotozuteの秘伝のタレを共通化)
 */
export default function TopTone({ color }: { color: string }) {
  useEffect(() => {
    const prevBg = document.body.style.background;
    document.body.style.background = color;
    let meta = document.querySelector('meta[name="theme-color"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const prevTheme = meta.getAttribute("content");
    meta.setAttribute("content", color);
    return () => {
      document.body.style.background = prevBg;
      if (created) meta?.remove();
      else if (meta && prevTheme) meta.setAttribute("content", prevTheme);
    };
  }, [color]);
  return null;
}
