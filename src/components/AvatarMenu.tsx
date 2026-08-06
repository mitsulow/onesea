"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadTotal } from "@/lib/line";
import { setBadge, ensureSw } from "@/lib/push";
import { fetchWarawaMissing } from "@/lib/warawa";

/* eslint-disable @next/next/no-img-element */

/**
 * 右上のアバター = 全サービスの入口。
 * どのページでも同じメニュー（ホーム/MMM/セカイムラ/ツキヨガ/楽市楽座/TALK/コトヅテ/手帳/マイページ/ログアウト）。
 * 下タブは「いま居るサービスの専用タブ」に譲る構造（Xのプロフィールメニューと同じ思想）。
 */
export function AvatarMenu({ ring = "#d4b96a" }: { ring?: string }) {
  const pathname = usePathname();
  const hereCls = (href: string) =>
    (href === "/" ? pathname === "/" : !href.startsWith("/#") && pathname.startsWith(href.split("?")[0]))
      ? " bg-[#fdf6e0] font-bold"
      : "";
  const [user, setUser] = useState<User | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [waraMissing, setWaraMissing] = useState(0); // わらわ〜会員の未入力数（0で消える）
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number }>({ top: 52, right: 12 });

  useEffect(() => {
    const supabase = createClient();
    let stop = false;
    let userId: string | null = null;

    ensureSw();

    const refresh = async () => {
      if (stop || !userId) return;
      const n = await fetchUnreadTotal(userId);
      if (!stop) {
        setUnread(n);
        setBadge(n);
      }
    };

    const refreshMissing = () => {
      if (userId) fetchWarawaMissing(userId).then((m) => setWaraMissing(m.missing.length));
    };
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      userId = session?.user?.id ?? null;
      refresh();
      refreshMissing();
      // マイページで変えた写真（profiles.avatar_url）を優先表示
      if (userId) {
        const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
        if (prof?.avatar_url) setProfileAvatar(prof.avatar_url);
      }
    });
    window.addEventListener("onesea:warawaMissingRefresh", refreshMissing);
    const t = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("onesea:unreadRefresh", refresh);
    return () => {
      stop = true;
      clearInterval(t);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("onesea:unreadRefresh", refresh);
      window.removeEventListener("onesea:warawaMissingRefresh", refreshMissing);
    };
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const avatar = profileAvatar ?? (user?.user_metadata?.avatar_url as string) ?? null;

  const item =
    "flex items-center gap-2.5 border-b border-[#f2ece0] px-4 py-2.5 text-[13.5px] font-medium text-[#3a3428] no-underline active:bg-[#faf4ea]";
  const icon = (src: string) => (
    <img src={src} alt="" className="h-[20px] w-[20px] flex-shrink-0 object-contain" />
  );

  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  };

  /* 通りすがり（未ログイン）: アバターと同じ大きさの丸に「ゲスト」。
     登録後は同じ位置が本物のアバターに変わる */
  if (!user) {
    return (
      <span className="relative inline-block">
        <button
          onClick={() => setOpen(true)}
          aria-label="登録・ログイン"
          className="flex h-8 w-8 items-center justify-center rounded-full border-2"
          style={{ borderColor: `${ring}b0`, background: "rgba(255,255,255,.05)" }}
        >
          <span className="text-[8px] font-bold leading-none" style={{ color: ring, letterSpacing: 0.5 }}>
            ゲスト
          </span>
        </button>
        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div className="fixed inset-0 z-[95] bg-black/45" onClick={() => setOpen(false)} />
              <div className="fixed inset-x-0 bottom-0 z-[96] mx-auto max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] rounded-t-3xl bg-white px-5 pb-8 pt-5">
                <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#e0d8c8]" />
                <button
                  onClick={login}
                  className="mb-2.5 w-full rounded-2xl py-3.5 text-[14.5px] font-extrabold text-white"
                  style={{ background: "linear-gradient(120deg,#2CB7DE,#1B8FB5)" }}
                >
                  OneSeaに登録（無料）
                </button>
                <button
                  onClick={login}
                  className="w-full rounded-2xl border border-[#e0d8c8] py-3 text-[12.5px] font-bold text-[#8a7a5a]"
                >
                  会員の方はログイン
                </button>
              </div>
            </>,
            document.body
          )}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        ref={btnRef}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setAnchor({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
          setOpen((v) => !v);
        }}
        aria-label="サービスメニュー"
        className="relative block"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full border-2 object-cover"
            style={{ borderColor: `${ring}b0` }}
          />
        ) : (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-base"
            style={{ borderColor: `${ring}b0` }}
          >
            🌊
          </span>
        )}
        {waraMissing > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-0.5 text-[9.5px] font-bold text-white"
            style={{ lineHeight: 1 }}
          >
            {waraMissing}
          </span>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
        <>
          <div className="fixed inset-0 z-[95]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[96] max-h-[80vh] w-56 overflow-y-auto rounded-xl border border-[#ede5d8] bg-white"
            style={{ top: anchor.top, right: anchor.right, boxShadow: "0 10px 36px rgba(0,0,0,0.22)" }}
          >
            <Link href="/mmm" onClick={() => setOpen(false)} className={item + hereCls("/mmm")}>
              {icon("/icons/cel-sun.png")} MasterMindMembers
            </Link>
            <Link href="/sekai" onClick={() => setOpen(false)} className={item + hereCls("/sekai")}>
              {icon("/icons/cel-earth.png")} セカイムラ
            </Link>
            <a href="/tsukiyoga-v7/index.html" className={item + hereCls("/tsukiyoga-v7")}>
              {icon("/icons/cel-moon.png")} ツキヨガ
            </a>
            <Link href="/cotozute" onClick={() => setOpen(false)} className={item + hereCls("/cotozute")}>
              {icon("/icons/tab-cotozute.png")} コトヅテ
            </Link>
            <Link href="/" onClick={() => setOpen(false)} className={item + hereCls("/")}>
              {icon("/icons/tab-home.png")} ホーム
            </Link>
            <Link href="/za" onClick={() => setOpen(false)} className={item + hereCls("/za")}>
              <img src="/rakuichi/logo-emblem.webp" alt="" className="h-[20px] w-[20px] flex-shrink-0 rounded-full object-cover" />
              楽市楽座
            </Link>
            <Link href="/#techo" onClick={() => setOpen(false)} className={item + hereCls("/#techo")}>
              <span className="w-[20px] text-center text-[16px]">📖</span> 手帳
            </Link>
            <Link href="/my" onClick={() => setOpen(false)} className={item + hereCls("/my")}>
              <span className="w-[20px] text-center text-[16px]">🪪</span> マイページ編集
              {waraMissing > 0 && (
                <span
                  className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {waraMissing}
                </span>
              )}
            </Link>
            <Link href="/talk" onClick={() => setOpen(false)} className={item + hereCls("/talk")}>
              <span className="w-[20px] text-center text-[16px]">💬</span> TALK
              {unread > 0 && (
                <span
                  className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <button onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-[#a05040] active:bg-[#faf4ea]">
              <span className="w-[20px] text-center text-[16px]">👋</span> ログアウト
            </button>
          </div>
        </>,
        document.body
      )}
    </span>
  );
}
