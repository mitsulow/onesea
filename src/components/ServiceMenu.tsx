"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/** 全サービス一覧(下タブの卵メニューと同じ並び) */
/**
 * MoAIの左上☰ — 全サービス統一ルール:
 * 上にサービスのロゴ+キャッチコピー → ◯◯トップ → そのサービスの下タブだけを並べる。
 * 他のサービスへのリンクはここには載せない(サービス移動は右上アバター or 卵メニュー)。
 */
const MOAI_MENU = [
  { href: "/moai", icon: "/icons/tab-home.png", label: "MoAI トップ" },
  { href: "/talk", icon: "/icons/icon-talk-green.webp", label: "TalK" },
];

export function ServiceMenuButton({ textColor = "#ffffff" }: { textColor?: string }) {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  useEffect(() => setPath(window.location.pathname), []);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="メニュー" className="text-[22px] leading-none" style={{ color: textColor }}>
        ☰
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[85] bg-black/35" onClick={() => setOpen(false)} />
            <div className="fixed left-0 top-0 z-[86] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
              <div className="px-5 pb-2 pt-5">
                <div className="text-[10px] tracking-[2px] text-[#c8a09a]">シュミサークル部活道</div>
                <div className="flex items-center gap-2 text-[19px] font-extrabold" style={{ color: "#c0392b" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/tab-home.png" alt="" className="h-[22px] w-[20px] object-contain" /> MoAI
                </div>
              </div>
              {MOAI_MENU.map((m) => {
                const here = path === m.href || (m.href !== "/moai" && path.startsWith(m.href));
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 border-b border-[#f6ece8] px-5 py-3 text-[14px] no-underline ${
                      here ? "bg-[#fbeeec] font-bold text-[#c0392b]" : "font-medium text-[#1c1e21]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                    {m.label}
                  </Link>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
