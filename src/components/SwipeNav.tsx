"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * サービス間の左右スワイプ周回ナビ。
 * 手帳 → コトヅテ → MMM → セカイムラ → MoAI → ツキヨガ → 楽市 → TALK → マイページ → (先頭へ)
 * 左スワイプ(指を左へ)=次のサービス / 右スワイプ=前のサービス。
 * 指に1:1で追従してページ全体が画面端まで滑り、離すと確定 or 戻る。
 * 確定後は行き先ページが反対側からスライドイン（方向は sessionStorage で受け渡し。
 * 静的ツキヨガ側の同名スクリプトと同じキーを共有）。
 *
 * 誤爆対策:
 * - サービスのトップページでのみ有効（深い画面では無効）
 * - 横スクロール可能な要素・canvas・入力欄・[data-noswipe] 内から始まるタッチは無視
 * - 強い横方向 (|dx| > 2.2|dy|) かつ 36px 動いてから追従開始
 * - 確定 = 画面幅の30%(上限140px) か フリック（速い指離し）
 * - touchcancel(OSジェスチャ等の中断)・遷移失敗時は元に戻す（固まり対策）
 */

const RING = [
  "/",          // 手帳（OneSeaトップ）
  "/cotozute",
  "/mmm",
  "/sekai",
  "/moai",
  "/tsukiyoga-v7/index.html", // 静的ページ
  "/za",
  "/talk",
  "/my",
];

const DIR_KEY = "swipe-nav-dir";

// スワイプ確定〜到着スライドインの間は true（この間は cleanup で transform を消さない）
let inFlight = false;

function ringIndex(pathname: string): number {
  if (pathname === "/") return 0;
  if (pathname === "/cotozute") return 1;
  if (pathname === "/mmm") return 2;
  if (pathname === "/sekai") return 3;
  if (pathname === "/moai") return 4;
  // ツキヨガは別ページなのでここには来ない (5)
  if (pathname === "/za") return 6;
  if (pathname === "/talk") return 7;
  if (pathname === "/my" || pathname.startsWith("/u/")) return 8; // マイページ(名刺)は /u/xxx に居る
  return -1;
}

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function SwipeNav() {
  const pathname = usePathname();
  const router = useRouter();

  // 到着側: スワイプで来ていたら反対側から画面幅スライドイン（描画前に位置決め＝パカ付き防止）
  useIsoLayoutEffect(() => {
    let dir: string | null = null;
    try { dir = sessionStorage.getItem(DIR_KEY); } catch { /* private mode */ }
    if (!dir) return;
    try { sessionStorage.removeItem(DIR_KEY); } catch { /* noop */ }
    const body = document.body;
    const vw = window.innerWidth;
    body.style.transition = "none";
    body.style.transform = `translateX(${dir === "next" ? vw : -vw}px)`;
    requestAnimationFrame(() => {
      body.style.transition = "transform .28s ease-out";
      body.style.transform = "";
      setTimeout(() => { body.style.transition = ""; inFlight = false; }, 300);
    });
  }, [pathname]);

  useEffect(() => {
    const idx = ringIndex(pathname);
    if (idx < 0) return;

    let startX = 0, startY = 0, dx = 0, dragging = false, canceled = false;
    let lastX = 0, lastT = 0, vx = 0;
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
      canceled = false; dragging = false; dx = 0; vx = 0;
      const t = e.target as Element | null;
      if (t && (t.closest("canvas, input, textarea, select, [data-noswipe], video") || scrollableX(t))) {
        canceled = true;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      lastX = startX;
      lastT = performance.now();
    };

    const onMove = (e: TouchEvent) => {
      if (canceled) return;
      if (e.defaultPrevented) { if (dragging) reset(true); canceled = true; return; }
      const x = e.touches[0].clientX;
      dx = x - startX;
      const dy = e.touches[0].clientY - startY;
      const now = performance.now();
      vx = (x - lastX) / Math.max(1, now - lastT); // px/ms（フリック判定用）
      lastX = x; lastT = now;
      if (!dragging) {
        if (Math.abs(dy) > 44 && Math.abs(dy) > Math.abs(dx)) { canceled = true; return; } // 縦スクロール
        if (Math.abs(dx) > 36 && Math.abs(dx) > 2.2 * Math.abs(dy)) dragging = true;
        else return;
      }
      // 指に1:1追従（開始しきい値36px分を差し引いて0から滑らかに）。画面端まで行ける
      const follow = dx > 0 ? Math.max(0, dx - 36) : Math.min(0, dx + 36);
      body.style.transition = "";
      body.style.transform = `translateX(${follow}px)`;
    };

    const commit = () => {
      const vw = window.innerWidth;
      const goNext = dx < 0;
      const next = goNext ? RING[(idx + 1) % RING.length] : RING[(idx + RING.length - 1) % RING.length];
      inFlight = true;
      try { sessionStorage.setItem(DIR_KEY, goNext ? "next" : "prev"); } catch { /* noop */ }
      // 画面外まで滑り切ってから遷移（最後までスワイプの手応え）
      body.style.transition = "transform .2s ease-out";
      body.style.transform = `translateX(${goNext ? -vw : vw}px)`;
      if (next.startsWith("/tsukiyoga-v7")) {
        setTimeout(() => { window.location.href = next; }, 160);
        // 遷移が始まらなかった時（オフライン等）は5秒で復帰＝固まり防止
        setTimeout(() => { if (inFlight) { inFlight = false; reset(true); } }, 5000);
      } else {
        setTimeout(() => router.push(next), 160);
      }
    };

    const onEnd = () => {
      if (!dragging) { canceled = false; return; }
      dragging = false;
      const vw = window.innerWidth;
      const flick = Math.abs(dx) > 60 && Math.abs(vx) > 0.5 && (vx < 0) === (dx < 0);
      if (Math.abs(dx) > Math.min(140, vw * 0.3) || flick) commit();
      else reset(true);
    };

    const onCancel = () => {
      if (dragging) reset(true);
      dragging = false;
      canceled = true;
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onCancel);
      // スワイプ遷移の途中（スライドアウト→到着スライドイン）は消さない
      if (!inFlight) reset(false);
    };
  }, [pathname, router]);

  return null;
}
