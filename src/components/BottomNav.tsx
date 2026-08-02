"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadTotal } from "@/lib/line";

/* eslint-disable @next/next/no-img-element */

/**
 * 下部タブ = 「いま居るサービス専用」のタブ。
 * 一番左のホームボタンは「そのサービスのホームへ飛ぶ + 全サービスの折りたたみメニュー」。
 * サービス間の行き来はこのメニュー（と右上アバター）が担う。
 */

interface Tab {
  href: string;
  icon: string; // 絵文字 or 画像パス（/で始まると画像）
  label: string;
  ext?: boolean; // 静的HTML・クエリ付き等、フルロードで開く
}

interface Service {
  match: (p: string) => boolean;
  home: string;
  isHome?: (p: string) => boolean;
  noHome?: boolean; // トップページ用: ホームボタンなし（全サービスタブのみ）
  homeExt?: boolean;
  bg: string;
  border: string;
  active: string;
  inactive: string;
  tabs: Tab[];
}

const SERVICES: Service[] = [
  {
    match: (p) => p.startsWith("/sekai"),
    home: "/sekai",
    bg: "linear-gradient(160deg,#0e2014f2,#1e4530f2)",
    border: "#2a4a35",
    active: "#eae6b8",
    inactive: "#8ab89a",
    tabs: [
      { href: "/sekai/villages", icon: "🏡", label: "拠点" },
      { href: "/sekai/clubs", icon: "🎌", label: "部活" },
      { href: "/sekai/kome", icon: "🌾", label: "米部" },
      { href: "/sekai/meister", icon: "🫙", label: "講座" },
      { href: "/sekai/tasukete", icon: "🤝", label: "助けて" },
      { href: "/sekai/map", icon: "🗾", label: "地図" },
    ],
  },
  {
    match: (p) => p.startsWith("/mmm"),
    home: "/mmm",
    bg: "linear-gradient(160deg,#0a1410f5,#12251af5)",
    border: "#1e4530",
    active: "#7de0a0",
    inactive: "#4a7a5a",
    tabs: [
      { href: "/mmm/neura", icon: "🧠", label: "ニューラFIVE" },
      { href: "/schumann1/index.html", icon: "⚡", label: "シューマン共振", ext: true },
      { href: "/mmm/ddp", icon: "🌊", label: "DDP設定" },
    ],
  },
  {
    match: (p) => p.startsWith("/tsukiyoga"),
    home: "/tsukiyoga",
    bg: "linear-gradient(160deg,#0a0c18f5,#12142af5)",
    border: "#2a2a45",
    active: "#f0e0a8",
    inactive: "#7a6a90",
    tabs: [
      { href: "/tsukiyoga-v7/index.html", icon: "🌕", label: "ツキヨガv7", ext: true },
      { href: "/my", icon: "🪪", label: "マイページ" },
    ],
  },
  {
    match: (p) => p.startsWith("/line"),
    home: "/line",
    bg: "linear-gradient(160deg,#0e1e2ef5,#17384ef5)",
    border: "#274a63",
    active: "#f0e6c8",
    inactive: "#7a9ab4",
    tabs: [{ href: "/line/broadcast", icon: "📢", label: "お知らせ" }],
  },
  {
    match: (p) => p.startsWith("/za"),
    home: "/za",
    bg: "rgba(255,253,248,.96)",
    border: "#e5dccb",
    active: "#c94d3a",
    inactive: "#a09888",
    tabs: [
      { href: "/za/new", icon: "🏮", label: "出品する" },
      { href: "/my", icon: "🪪", label: "マイページ" },
    ],
  },
  {
    match: (p) => p.startsWith("/u/") || p === "/my" || p.startsWith("/settings"),
    home: "/my",
    isHome: (p) => p === "/my" || p.startsWith("/u/"),
    bg: "rgba(255,253,248,.96)",
    border: "#e5dccb",
    active: "#c94d3a",
    inactive: "#a09888",
    tabs: [], // マイページはホーム（卵）だけ。編集などはページ内から
  },
];

/** ホームボタンの折りたたみメニュー（全サービス一覧） */
const MENU: Array<{ href: string; icon: string; label: string; ext?: boolean; talk?: boolean }> = [
  { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM" },
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
  { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
  { href: "/cotozute", icon: "/icons/tab-cotozute.png", label: "コトヅテ" },
  { href: "/", icon: "/icons/tab-home.png", label: "HOME" },
  { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
  { href: "/#techo", icon: "📖", label: "手帳", ext: true },
  { href: "/my", icon: "🪪", label: "マイページ" },
  { href: "/line", icon: "💬", label: "TALK", talk: true },
];

function TabIcon({ icon, active }: { icon: string; active: boolean }) {
  const cls = `transition-transform duration-150 ${active ? "-translate-y-0.5 scale-[1.3]" : ""}`;
  if (icon.startsWith("/")) {
    return <img src={icon} alt="" className={`object-contain ${cls}`} style={{ width: 21, height: 19 }} />;
  }
  return <span className={`text-lg leading-none ${cls}`}>{icon}</span>;
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [kbOpen, setKbOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    const supabase = createClient();
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid || stop) return;
      const n = await fetchUnreadTotal(uid);
      if (!stop) setUnread(n);
    };
    run();
    const t = setInterval(run, 30000);
    window.addEventListener("onesea:unreadRefresh", run);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("onesea:unreadRefresh", run);
    };
  }, [pathname]);

  useEffect(() => setMenu(false), [pathname]);

  // iOS: キーボードが開くと fixed バーが浮くため、文字入力中は隠す
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

  const svc = SERVICES.find((s) => s.match(pathname));
  if (kbOpen || !svc) return null;

  const isActive = (href: string) =>
    href !== svc.home && !href.startsWith("#") && pathname.startsWith(href.split("?")[0].split("|").pop() ?? href);
  const atHome = svc.isHome ? svc.isHome(pathname) : pathname === svc.home;

  const onHome = () => {
    if (!atHome) router.push(svc.home);
    setMenu((v) => !v);
  };

  return (
    <>
      {/* ホームボタンの折りたたみメニュー */}
      {menu && <div className="fixed inset-0 z-40 bg-black/35" onClick={() => setMenu(false)} />}
      {menu && (
        <div
          className="fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-3"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 62px)" }}
        >
          <div
            className="grid grid-cols-3 gap-2 rounded-2xl p-3"
            style={{ background: svc.bg, border: `1px solid ${svc.border}`, boxShadow: "0 -6px 40px rgba(0,0,0,.45)" }}
          >
            {MENU.map((m) =>
              m.ext ? (
                <a
                  key={m.href}
                  href={m.href}
                  className="flex flex-col items-center gap-1 rounded-xl bg-white/8 py-3 no-underline"
                  style={{ background: "rgba(255,255,255,.07)" }}
                >
                  {m.icon.startsWith("/") ? (
                    <img src={m.icon} alt="" className="h-[26px] w-[26px] object-contain" />
                  ) : (
                    <span className="relative text-[24px] leading-none">
                      {m.icon}
                      {m.talk && unread > 0 && (
                        <span className="absolute -right-3 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9px] font-bold text-white" style={{ lineHeight: 1 }}>
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="text-[10.5px] font-extrabold" style={{ color: svc.active }}>
                    {m.label}
                  </span>
                </a>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setMenu(false)}
                  className="flex flex-col items-center gap-1 rounded-xl py-3 no-underline"
                  style={{ background: "rgba(255,255,255,.07)" }}
                >
                  {m.icon.startsWith("/") ? (
                    <img src={m.icon} alt="" className="h-[26px] w-[26px] object-contain" />
                  ) : (
                    <span className="relative text-[24px] leading-none">
                      {m.icon}
                      {m.talk && unread > 0 && (
                        <span className="absolute -right-3 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9px] font-bold text-white" style={{ lineHeight: 1 }}>
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </span>
                  )}
                  <span className="text-[10.5px] font-extrabold" style={{ color: svc.active }}>
                    {m.label}
                  </span>
                </Link>
              )
            )}
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t"
        style={{ background: svc.bg, borderColor: svc.border, backdropFilter: "blur(6px)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex h-[54px] items-center justify-around">
          {/* ホーム（サービスのホームへ + 全サービスメニュー）。トップページでは出さない */}
          {!svc.noHome && (
          <button onClick={onHome} className="relative flex flex-1 flex-col items-center gap-0.5 py-1">
            <img
              src="/icons/tab-home.png"
              alt=""
              className={`object-contain transition-transform duration-150 ${atHome ? "-translate-y-0.5 scale-[1.3]" : ""}`}
              style={{ width: 17, height: 21 }}
            />
            <span className={`flex items-center gap-0.5 text-[9px] leading-none ${atHome ? "font-bold" : "font-medium"}`} style={{ color: atHome ? svc.active : svc.inactive }}>
              ホーム <span className="text-[7px]">{menu ? "▾" : "▴"}</span>
            </span>
          </button>
          )}

          {svc.tabs.map((t) => {
            const realHref = t.href.includes("|") ? t.href.split("|")[1] : t.href;
            const active = isActive(t.href);
            const inner = (
              <>
                <TabIcon icon={t.icon} active={active} />
                <span className={`text-[9px] leading-none ${active ? "font-bold" : "font-medium"}`} style={{ color: active ? svc.active : svc.inactive }}>
                  {t.label}
                </span>
              </>
            );
            return t.ext ? (
              <a key={t.href} href={realHref} className="relative flex flex-1 flex-col items-center gap-0.5 py-1 no-underline">
                {inner}
              </a>
            ) : (
              <Link key={t.href} href={realHref} className="relative flex flex-1 flex-col items-center gap-0.5 py-1 no-underline">
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
