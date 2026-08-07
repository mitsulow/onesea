"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * サービス間の左右スワイプ周回ナビ。
 * 手帳 → コトヅテ → MMM → セカイムラ → ツキヨガ → 楽市 → TALK → マイページ → (先頭へ)
 * 左スワイプ(指を左へ)=次のサービス / 右スワイプ=前のサービス。
 * 「スワイプしている手応え」: 指に追従してページが途中まで動き、離すと遷移 or 戻る。
 *
 * 誤爆対策:
 * - サービスのトップページでのみ有効（深い画面では無効）
 * - 横スクロール可能な要素・canvas・入力欄・[data-noswipe] 内から始まるタッチは無視
 * - 強い横方向 (|dx| > 2.2|dy|) かつ 36px 動いてから追従開始、遷移は 110px 以上
 * - 他のハンドラが preventDefault したら即キャンセル
 */

const RING = [
  "/",          // 手帳（OneSeaトップ）
  "/cotozute",
  "/mmm",
  "/sekai",
  "/tsukiyoga-v7/index.html", // 静的ページ
  "/za",
  "/talk",
  "/my",
];

function ringIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/cotozute") return 1;
  if (pathname === "/mmm") return 2;
  if (pathname === "/sekai") return 3;
  // ツキヨガは別ページなのでここには来ない (4)
  if (pathname === "/za") return 5;
  if (pathname === "/talk") return 6;
  if (pathname === "/my" || pathname.startsWith("/u/")) return 7; // マイページ(名刺)は /u/xxx に居る
  return -1;
}

export default function SwipeNav() {
  const pathname = usePathname();

  useEffect(() => {
    const idx = ringIndex(pathname);
    if (idx < 0) return;

    let startX = 0, startY = 0, dx = 0, dragging = false, canceled = false;
    const body = document.body;

    const scrollableX = (el: Element | null): boolean => {
      while (el && el !== document.body) {
        const st = getComputedStyle(el);
        if ((st.overflowX === "auto" || st.overflowX === "scroll") && el.scrollWidth > el.clientWidth + 4) return true;
        el = el.parentElement;
      }
      return false;
    };

    const reset = (animate: boolean) => {
      body.style.transition = animate ? "transform .22s ease" : "";
      body.style.transform = "";
      dragging = false;
      if (animate) setTimeout(() => { body.style.transition = ""; }, 240);
    };

    const onStart = (e: TouchEvent) => {
      canceled = false; dragging = false; dx = 0;
      const t = e.target as Element | null;
      if (t && (t.closest("canvas, input, textarea, select, [data-noswipe], video") || scrollableX(t))) {
        canceled = true;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (canceled) return;
      if (e.defaultPrevented) { if (dragging) reset(true); canceled = true; return; }
      dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!dragging) {
        if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) { canceled = true; return; } // 縦スクロール
        if (Math.abs(dx) > 36 && Math.abs(dx) > 2.2 * Math.abs(dy)) dragging = true;
        else return;
      }
      // 指に追従（抵抗つき）。ページの途中くらいまで
      const follow = Math.max(-160, Math.min(160, dx * 0.45));
      body.style.transition = "";
      body.style.transform = `translateX(${follow}px)`;
    };

    const onEnd = () => {
      if (!dragging) { canceled = false; return; }
      if (Math.abs(dx) > 110) {
        const next = dx < 0 ? RING[(idx + 1) % RING.length] : RING[(idx + RING.length - 1) % RING.length];
        // スライドアウトしてから遷移（手応えの余韻）
        body.style.transition = "transform .18s ease-in";
        body.style.transform = `translateX(${dx < 0 ? -220 : 220}px)`;
        setTimeout(() => { window.location.href = next; }, 150);
      } else {
        reset(true);
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      reset(false);
    };
  }, [pathname]);

  return null;
}
