"use client";

import { useState } from "react";
import Link from "next/link";

/** 全サービス一覧(下タブの卵メニューと同じ並び) */
const ALL = [
  { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM" },
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
  { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
  { href: "/cotozute", icon: "/icons/tab-cotozute2.webp", label: "コトヅテ" },
  { href: "/moai", icon: "/icons/icon-moai.webp", label: "MOAI" },
  { href: "/za", icon: "/icons/icon-za-mark.svg", label: "楽市楽座" },
  { href: "/", icon: "/icons/tab-home.png", label: "OneSea" },
  { href: "/#techo", icon: "/icons/icon-techo.webp", label: "手帳", ext: true },
  { href: "/my", icon: "/icons/icon-profile.webp", label: "マイページ編集" },
  { href: "/talk", icon: "/icons/icon-chat.webp", label: "TalK" },
];

/**
 * 三本線メニュー — どのサービスからでも他サービスへ飛べる共通ボタン。
 * color/textColor で各サービスの見出し色に合わせられる。
 */
export function ServiceMenuButton({ color = "#c0392b", textColor = "#c0392b" }: { color?: string; textColor?: string }) {
  const [open, setOpen] = useState(false);
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="メニュー" className="text-[22px] leading-none" style={{ color: textColor }}>
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[85] bg-black/35" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 z-[86] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
            <div className="px-5 pb-2 pt-5 text-[19px] font-extrabold" style={{ color }}>
              サービス一覧
            </div>
            {ALL.map((m) => {
              const here = path === m.href || (m.href !== "/" && !m.ext && path.startsWith(m.href));
              const cls = `flex items-center gap-3 border-b border-[#f2ece0] px-5 py-3 text-[14px] no-underline ${
                here ? "bg-[#faf0ee] font-bold" : "font-medium text-[#3a3428]"
              }`;
              const style = here ? { color } : undefined;
              const inner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  {m.label}
                </>
              );
              return m.ext ? (
                <a key={m.href} href={m.href} className={cls} style={style}>{inner}</a>
              ) : (
                <Link key={m.href} href={m.href} onClick={() => setOpen(false)} className={cls} style={style}>{inner}</Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
