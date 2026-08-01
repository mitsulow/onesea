"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadTotal } from "@/lib/line";
import { setBadge, ensureSw } from "@/lib/push";
import { LINKS } from "@/lib/config";

/** 下部タブ: ホーム / MMM(太陽) / セカイムラ(地球) / ツキヨガ(月) / 楽市楽座(楽) / LINE */
export function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [sekaiMenu, setSekaiMenu] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);

  // ページが変わったらメニューを閉じる
  useEffect(() => setSekaiMenu(false), [pathname]);

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

  useEffect(() => {
    let stop = false;
    let userId: string | null = null;
    const supabase = createClient();

    ensureSw(); // プッシュ受信用SWを常に登録しておく

    const refresh = async () => {
      if (stop || !userId) return;
      const n = await fetchUnreadTotal(userId);
      if (!stop) {
        setUnread(n);
        setBadge(n); // ホーム画面アイコンの「③」も同期
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      userId = session?.user?.id ?? null;
      refresh();
    });
    const t = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("onesea:unreadRefresh", refresh);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("onesea:unreadRefresh", refresh);
    };
  }, [pathname]);

  const itemCls = (active: boolean) => {
    void active;
    return "relative flex flex-1 flex-col items-center gap-0.5 py-1 no-underline text-[#8a8070]";
  };

  const label = (text: string, active = false) => (
    <span className={`text-[9px] leading-none ${active ? "font-bold" : "font-medium"}`}>{text}</span>
  );


  const inSekai = pathname.startsWith("/sekai");

  const SEKAI_PAGES = [
    ["/sekai", "🏠", "ホーム"],
    ["/sekai/villages", "⛺", "拠点情報"],
    ["/sekai/clubs", "🎌", "部活情報"],
    ["/sekai/kome", "🌾", "米部"],
    ["/sekai/meister", "🫙", "マイスター講座"],
    ["/sekai/tasukete", "🤝", "助けて掲示板"],
    ["/sekai/map", "🗾", "セカイムラ地図"],
  ] as const;
  const sekaiActive = (href: string) => (href === "/sekai" ? pathname === "/sekai" : pathname.startsWith(href));
  const current = SEKAI_PAGES.find(([href]) => sekaiActive(href));
  void current;

  // 文字入力中（キーボード表示中）はバーを出さない
  if (kbOpen) return null;

  return (
    <>
      {/* セカイムラ内: フローティングメニュー（地球から開くページ一覧） */}
      {inSekai && (
        <>
          {sekaiMenu && <div className="fixed inset-0 z-40 bg-black/35" onClick={() => setSekaiMenu(false)} />}
          <div
            className="pointer-events-none fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 px-3"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 62px)" }}
          >
            {sekaiMenu && (
              <div
                className="pointer-events-auto mb-2 grid grid-cols-3 gap-2 rounded-2xl p-3"
                style={{
                  background: "linear-gradient(160deg,#0e2014,#1e4530)",
                  border: "1px solid #4a9a6a55",
                  boxShadow: "0 -6px 40px rgba(0,0,0,.45)",
                }}
              >
                {SEKAI_PAGES.map(([href, emoji, label]) => {
                  const active = sekaiActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setSekaiMenu(false)}
                      className="flex flex-col items-center gap-1 rounded-xl py-3 no-underline"
                      style={
                        active
                          ? { background: "rgba(212,185,106,.16)", border: "1.5px solid #d4b96a" }
                          : { background: "rgba(255,255,255,.05)", border: "1.5px solid transparent" }
                      }
                    >
                      <span className={active ? "text-[30px]" : "text-[24px]"}>{emoji}</span>
                      <span
                        className="text-[10.5px] font-extrabold leading-tight"
                        style={{ color: active ? "#eae6b8" : "#a8cca8" }}
                      >
                        {label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
            <div className="flex justify-start">
              <button
                onClick={() => setSekaiMenu((v) => !v)}
                aria-label="セカイムラのメニュー"
                className="pointer-events-auto flex h-[46px] w-[46px] flex-col items-center justify-center rounded-full shadow-xl"
                style={{
                  background: "linear-gradient(150deg,#163522,#1e4530)",
                  border: "1px solid #4a9a6a88",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/cel-earth.png" alt="" className="h-[22px] w-[22px] object-contain" />
                <span className="text-[8px] leading-none text-[#8ab89a]">{sekaiMenu ? "▾" : "▴"}</span>
              </button>
            </div>
          </div>
        </>
      )}

    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-[#e5dccb] bg-[#fffdf8]/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[54px] items-center justify-around">
        {/* ホーム */}
        <Link href="/" className={itemCls(pathname === "/")}>
          <span
            className={`text-lg leading-none transition-transform duration-150 ${pathname === "/" ? "-translate-y-0.5 scale-[1.35]" : ""}`}
          >
            🏠
          </span>
          {label("ホーム", pathname === "/")}
        </Link>

        {/* MMM = 太陽（OneSea内のMMMサイトへ） */}
        <Link href="/mmm" className={itemCls(pathname.startsWith("/mmm"))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/cel-sun.png"
            alt=""
            className={`object-contain transition-transform duration-150 ${pathname.startsWith("/mmm") ? "-translate-y-0.5 scale-[1.35]" : "active:scale-125"}`}
            style={{ width: 22, height: 22 }}
          />
          {label("MMM", pathname.startsWith("/mmm"))}
        </Link>

        {/* セカイムラ = 地球 */}
        <Link href="/sekai" className={itemCls(pathname.startsWith("/sekai"))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/cel-earth.png"
            alt=""
            className={`object-contain transition-transform duration-150 ${pathname.startsWith("/sekai") ? "-translate-y-0.5 scale-[1.35]" : "active:scale-125"}`}
            style={{ width: 22, height: 22 }}
          />
          {label("セカイムラ", pathname.startsWith("/sekai"))}
        </Link>

        {/* ツキヨガ = 月 */}
        <Link href={LINKS.tsukiyoga} className={itemCls(pathname.startsWith("/tsukiyoga"))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/cel-moon.png"
            alt=""
            className={`object-contain transition-transform duration-150 ${pathname.startsWith("/tsukiyoga") ? "-translate-y-0.5 scale-[1.35]" : "active:scale-125"}`}
            style={{ width: 22, height: 22 }}
          />
          {label("ツキヨガ", pathname.startsWith("/tsukiyoga"))}
        </Link>

        {/* 楽市楽座 = 「楽」 */}
        <Link href="/za" className={itemCls(pathname.startsWith("/za"))}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/rakuichi/logo-emblem.webp"
            alt=""
            className={`rounded-full object-cover transition-transform duration-150 ${pathname.startsWith("/za") ? "-translate-y-0.5 scale-[1.35]" : "active:scale-125"}`}
            style={{ width: 21, height: 21 }}
          />
          {label("楽市楽座", pathname.startsWith("/za"))}
        </Link>

        {/* LINE */}
        <Link href="/line" className={itemCls(pathname.startsWith("/line"))}>
          <span
            className={`relative text-lg leading-none transition-transform duration-150 ${pathname.startsWith("/line") ? "-translate-y-0.5 scale-[1.35]" : ""}`}
          >
            💬
            {unread > 0 && (
              <span
                className="absolute -right-3 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9px] font-bold text-white"
                style={{ lineHeight: 1 }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {label("LINE", pathname.startsWith("/line"))}
        </Link>
      </div>
    </nav>
    </>
  );
}
