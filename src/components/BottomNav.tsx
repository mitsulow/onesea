"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadTotal } from "@/lib/line";
import { LINKS } from "@/lib/config";

/** 下部タブ: ホーム / MMM(太陽) / セカイムラ(地球) / ツキヨガ(月) / 楽市楽座(楽) / LINE */
export function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stop = false;
    let userId: string | null = null;
    const supabase = createClient();

    const refresh = async () => {
      if (stop || !userId) return;
      const n = await fetchUnreadTotal(userId);
      if (!stop) setUnread(n);
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

  const itemCls = (active: boolean) =>
    `relative flex flex-1 flex-col items-center gap-0.5 py-1 no-underline ${
      active ? "text-[#c94d3a]" : "text-[#b0a898]"
    }`;

  const label = (text: string, active = false) => (
    <span className={`text-[9px] leading-none ${active ? "font-bold" : "font-medium"}`}>{text}</span>
  );

  const activeBar = (
    <span className="absolute left-1/2 top-0 h-[3px] w-6 -translate-x-1/2 rounded-b-full bg-[#c94d3a]" />
  );

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t border-[#e5dccb] bg-[#fffdf8]/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-[54px] items-center justify-around">
        {/* ホーム */}
        <Link href="/" className={itemCls(pathname === "/")}>
          {pathname === "/" && activeBar}
          <span className="text-lg leading-none">🌊</span>
          {label("ホーム", pathname === "/")}
        </Link>

        {/* MMM = 太陽 */}
        <a href={LINKS.mmm} target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
          <span className="cel cel-sun" style={{ width: 21, height: 21 }} />
          {label("MMM")}
        </a>

        {/* セカイムラ = 地球 */}
        <a href={LINKS.sekaimura} target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
          <span className="cel cel-earth" style={{ width: 21, height: 21 }} />
          {label("セカイムラ")}
        </a>

        {/* ツキヨガ = 月 */}
        <a href={LINKS.tsukiyoga} target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
          <span className="cel cel-moon" style={{ width: 21, height: 21 }} />
          {label("ツキヨガ")}
        </a>

        {/* 楽市楽座 = 「楽」 */}
        <Link href="/za" className={itemCls(pathname.startsWith("/za"))}>
          {pathname.startsWith("/za") && activeBar}
          <span
            className="flex items-center justify-center rounded-full text-[12px] font-extrabold text-white"
            style={{ width: 21, height: 21, background: "#c94d3a", lineHeight: 1 }}
          >
            楽
          </span>
          {label("楽市楽座", pathname.startsWith("/za"))}
        </Link>

        {/* LINE */}
        <Link href="/line" className={itemCls(pathname.startsWith("/line"))}>
          {pathname.startsWith("/line") && activeBar}
          <span className="relative text-lg leading-none">
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
  );
}
