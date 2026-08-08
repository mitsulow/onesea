"use client";

import { useEffect } from "react";

/**
 * キャッシュ溜まりすぎ対策 — 開いた時と画面復帰時に版数を確認し、
 * 新しいビルドが出ていたら1回だけ自動で再読み込みして最新にする。
 * （無限リロード防止: 同じ版への再読み込みは sessionStorage で1回に制限）
 */
export function VersionGuard() {
  useEffect(() => {
    let current: string | null = null;
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { v } = await r.json();
        if (!v) return;
        if (current === null) {
          current = v;
          // 初回: サーバー版と食い違う古いHTMLを掴んでいたら更新
          const seen = sessionStorage.getItem("onesea-build");
          if (seen && seen !== v) {
            sessionStorage.setItem("onesea-build", v);
            location.reload();
            return;
          }
          sessionStorage.setItem("onesea-build", v);
          return;
        }
        if (v !== current && sessionStorage.getItem("onesea-build") !== v) {
          sessionStorage.setItem("onesea-build", v);
          location.reload();
        }
      } catch {}
    };
    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, 5 * 60000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);
  return null;
}
