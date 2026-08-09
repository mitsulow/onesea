"use client";

import { setCurrentUid } from "@/lib/techoStore";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { subscribeUnread } from "@/lib/unreadStore";
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
  const [isAdmin, setIsAdmin] = useState(false); // 事務局
  const [notifN, setNotifN] = useState(0); // 🔔お知らせ未読
  const [inqOpen, setInqOpen] = useState(false); // 事務局への問い合わせ
  const [inqBody, setInqBody] = useState("");
  const [inqBusy, setInqBusy] = useState(false);
  const [inqDone, setInqDone] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top: number; right: number }>({ top: 52, right: 12 });

  useEffect(() => {
    const supabase = createClient();
    let stop = false;
    let userId: string | null = null;
    let unsub: (() => void) | null = null;

    ensureSw();

    const refreshMissing = () => {
      if (userId) fetchWarawaMissing(userId).then((m) => setWaraMissing(m.missing.length));
    };
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (stop) return;
      setUser(session?.user ?? null);
      userId = session?.user?.id ?? null;
      setCurrentUid(userId); // 手帳などの端末保存をユーザーごとに分離するための現在uid
      refreshMissing();
      if (userId) {
        import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(userId!).then(setIsAdmin)).catch(() => {});
        const refreshNotif = () => {
          import("@/lib/notifications").then(({ fetchNotifUnread }) => fetchNotifUnread(userId!).then(setNotifN)).catch(() => {});
        };
        refreshNotif();
        window.addEventListener("onesea:notifRefresh", refreshNotif);
        window.addEventListener("onesea:unreadRefresh", refreshNotif);
      }
      // 未読は共有ポーラー（1タブ1本・非表示中は止まる）から受け取る
      if (userId) {
        unsub = subscribeUnread(userId, (n) => {
          setUnread(n);
          setBadge(n);
        });
        // マイページで変えた写真（profiles.avatar_url）を優先表示
        const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle();
        if (prof?.avatar_url) setProfileAvatar(prof.avatar_url);
      }
    });
    window.addEventListener("onesea:warawaMissingRefresh", refreshMissing);
    return () => {
      stop = true;
      unsub?.();
      window.removeEventListener("onesea:warawaMissingRefresh", refreshMissing);
    };
  }, []);

  const logout = async () => {
    const supabase = createClient();
    setCurrentUid(null); // ゲストに前の人の予定が見えないように
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
              <div className="fixed inset-0 z-[95] bg-black/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
              <div className="fixed inset-x-0 bottom-0 z-[96] mx-auto max-w-[480px] overflow-hidden rounded-t-3xl bg-white pb-8 shadow-2xl">
                {/* 海の夜明け（Adobe Stock）で「入りたくなる」ヒーロー */}
                <div className="relative h-[220px] w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/lp/onesea/hero-sea.webp" alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(8,17,28,0.15),rgba(8,17,28,0.35) 45%,rgba(255,255,255,0.98) 98%)" }} />
                  <div className="absolute inset-x-0 bottom-3 text-center">
                    <div className="text-[11px] font-bold tracking-[5px] text-[#f0e6c8]" style={{ textShadow: "0 1px 8px rgba(0,0,0,.7)" }}>ONESEA</div>
                    <div className="mt-1 text-[22px] font-extrabold tracking-[2px] text-white" style={{ fontFamily: '"Shippori Mincho",serif', textShadow: "0 2px 12px rgba(0,0,0,.6)" }}>
                      海は7つに分かれていない。OneSea
                    </div>
                  </div>
                </div>
                <div className="px-5 pt-4">
                  <p className="mb-3 text-center text-[12.5px] leading-relaxed text-[#6a6055]">
                    太陽と月と潮のリズムで生きる、<b className="text-[#2a2622]">無料の手帳アプリ</b>。<br />
                    暦・シューマン共振・みんなの投稿が、無料で使えます。
                  </p>
                  <button
                    onClick={login}
                    className="mb-2.5 w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white"
                    style={{ background: "linear-gradient(120deg,#2CB7DE,#1B8FB5)", boxShadow: "0 6px 20px rgba(44,183,222,.35)" }}
                  >
                    OneSeaに登録（無料・30秒）
                  </button>
                  <button
                    onClick={login}
                    className="w-full rounded-2xl border border-[#e0d8c8] py-3 text-[12.5px] font-bold text-[#8a7a5a]"
                  >
                    会員の方はログイン
                  </button>
                </div>
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
            className="flex h-8 w-8 items-center justify-center rounded-full border-2"
            style={{ borderColor: `${ring}b0` }}
          >
            <span className="text-[8px] font-bold leading-none tracking-[0.5px]">ゲスト</span>
          </span>
        )}
        {unread + notifN > 0 && (
          <span
            className="num absolute -right-1.5 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[10px] font-extrabold text-white"
            style={{ lineHeight: 1, boxShadow: "0 0 0 1.5px #fff" }}
          >
            {unread + notifN > 99 ? "99+" : unread + notifN}
          </span>
        )}
        {waraMissing > 0 && (
          <span
            className="absolute -bottom-1 -right-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#e05040] px-0.5 text-[9.5px] font-bold text-white"
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
            <Link href="/notifications" onClick={() => setOpen(false)} className={item + hereCls("/notifications")}>
              <span className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center text-[16px]">🔔</span> お知らせ
              {notifN > 0 && (
                <span
                  className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {notifN > 99 ? "99+" : notifN}
                </span>
              )}
            </Link>
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
              {icon("/icons/tab-cotozute2.webp")} コトヅテ
            </Link>
            <Link href="/" onClick={() => setOpen(false)} className={item + hereCls("/")}>
              {icon("/icons/tab-home.png")} OneSea
            </Link>
            <Link href="/za" onClick={() => setOpen(false)} className={item + hereCls("/za")}>
              <img src="/rakuichi/logo-emblem.webp" alt="" className="h-[20px] w-[20px] flex-shrink-0 rounded-full object-cover" />
              楽市楽座
            </Link>
            <Link href="/moai" onClick={() => setOpen(false)} className={item + hereCls("/moai")}>
              {icon("/icons/icon-moai.webp")} MOAI
            </Link>
            <Link href="/#techo" onClick={() => setOpen(false)} className={item + hereCls("/#techo")}>
              {icon("/icons/icon-techo.webp")} 手帳
            </Link>
            <Link href="/my" onClick={() => setOpen(false)} className={item + hereCls("/my")}>
              {icon("/icons/icon-profile.webp")} マイページ編集
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
              {icon("/icons/icon-chat.webp")} TalK
              {unread > 0 && (
                <span
                  className="ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#e05040] px-1 text-[9.5px] font-bold text-white"
                  style={{ lineHeight: 1 }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <button
              onClick={() => { setOpen(false); setInqOpen(true); setInqDone(false); }}
              className="flex w-full items-center gap-2.5 border-b border-[#f2ece0] px-4 py-2.5 text-left text-[13.5px] font-medium text-[#3a3428] active:bg-[#faf4ea]"
            >
              {icon("/icons/icon-megaphone.webp")} 事務局への問い合わせ
            </button>
            {isAdmin && (
              <Link href="/office" onClick={() => setOpen(false)} className={item + hereCls("/office")}>
                {icon("/icons/icon-megaphone.webp")} 事務局
              </Link>
            )}
            <button onClick={logout} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13.5px] font-medium text-[#a05040] active:bg-[#faf4ea]">
              {icon("/icons/icon-logout.webp")} ログアウト
            </button>
            <div className="px-4 pb-1.5 pt-0.5 text-right text-[8px] text-[#c8c0b0]">
              build {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev"}
            </div>
          </div>
        </>,
        document.body
      )}
      {inqOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[130] flex items-center justify-center px-5">
            <div className="absolute inset-0 bg-black/55" onClick={() => setInqOpen(false)} />
            <div className="relative w-full max-w-[360px] rounded-3xl bg-white p-5">
              <div className="text-[15px] font-extrabold text-[#3a3428]">✉ 事務局への問い合わせ</div>
              {inqDone ? (
                <>
                  <p className="mt-3 text-[13px] leading-relaxed text-[#5a5448]">
                    送信しました。事務局（マスター・マチルダ・西田あかね）が確認して、必要ならTalKでお返事します。
                  </p>
                  <button onClick={() => setInqOpen(false)} className="mt-4 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white" style={{ background: "#1a2432" }}>
                    とじる
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-[#a09888]">バグ報告・使い方の質問・要望など、なんでもどうぞ</p>
                  <textarea
                    value={inqBody}
                    onChange={(e) => setInqBody(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    placeholder="内容を書いてください"
                    className="mt-2 w-full resize-none rounded-xl border border-[#e8dcc4] bg-[#fffdf8] p-3 text-[13.5px] outline-none focus:border-[#c94d3a]"
                  />
                  <button
                    disabled={!inqBody.trim() || inqBusy || !user}
                    onClick={async () => {
                      if (!user) return;
                      setInqBusy(true);
                      const supabase = createClient();
                      const { error } = await supabase.from("inquiries").insert({ user_id: user.id, body: inqBody.trim() });
                      setInqBusy(false);
                      if (error) { alert("送信できませんでした: " + error.message); return; }
                      setInqBody("");
                      setInqDone(true);
                    }}
                    className="mt-2.5 w-full rounded-2xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40"
                    style={{ background: "#c94d3a" }}
                  >
                    {inqBusy ? "送信中..." : user ? "事務局へ送る" : "ログインすると送れます"}
                  </button>
                  <button onClick={() => setInqOpen(false)} className="mt-2 block w-full text-center text-[11px] text-[#a09888]">キャンセル</button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
