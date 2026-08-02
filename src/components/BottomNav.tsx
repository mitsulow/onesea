"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * 下部タブ = 「いま居るサービスの専用タブ」方式。
 * サービス間の行き来は右上アバターの AvatarMenu が担う。
 * いまはセカイムラ専用タブのみ（MMM等は専用ページが増えたら追加）。
 */
export function BottomNav() {
  const pathname = usePathname();
  const [kbOpen, setKbOpen] = useState(false);

  // iOS: キーボードが開くと fixed バーが画面の途中に浮くため、文字入力中はタブを隠す
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    const onIn = (e: FocusEvent) => {
      if (isField(e.target)) setKbOpen(true);
    };
    const onOut = () => {
      setTimeout(() => {
        const a = document.activeElement;
        if (!(a && ["INPUT", "TEXTAREA", "SELECT"].includes(a.tagName))) setKbOpen(false);
      }, 60);
    };
    window.addEventListener("focusin", onIn);
    window.addEventListener("focusout", onOut);
    return () => {
      window.removeEventListener("focusin", onIn);
      window.removeEventListener("focusout", onOut);
    };
  }, []);

  const SEKAI_PAGES = [
    ["/sekai", "🏠", "ホーム"],
    ["/sekai/villages", "⛺", "拠点"],
    ["/sekai/clubs", "🎌", "部活"],
    ["/sekai/kome", "🌾", "米部"],
    ["/sekai/meister", "🫙", "講座"],
    ["/sekai/tasukete", "🤝", "助けて"],
    ["/sekai/map", "🗾", "地図"],
  ] as const;

  if (kbOpen) return null;
  if (!pathname.startsWith("/sekai")) return null;

  const sekaiActive = (href: string) => (href === "/sekai" ? pathname === "/sekai" : pathname.startsWith(href));

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-[#2a4a35]"
      style={{
        background: "linear-gradient(160deg,#0e2014f2,#1e4530f2)",
        backdropFilter: "blur(6px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex h-[54px] items-center justify-around">
        {SEKAI_PAGES.map(([href, emoji, label]) => {
          const active = sekaiActive(href);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-0.5 py-1 no-underline"
            >
              <span
                className={`text-lg leading-none transition-transform duration-150 ${active ? "-translate-y-0.5 scale-[1.3]" : ""}`}
              >
                {emoji}
              </span>
              <span
                className={`text-[9px] leading-none ${active ? "font-bold" : "font-medium"}`}
                style={{ color: active ? "#eae6b8" : "#8ab89a" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
