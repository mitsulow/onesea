"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ChatSummary, fetchChats } from "@/lib/line";
import { enablePush, pushEnabled, pushSupported } from "@/lib/push";

function timeLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** LINE — トーク一覧（相手・最新メッセージ・未読数） */
export default function LinePage() {
  const [me, setMe] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [showBell, setShowBell] = useState(false);
  const [bellBusy, setBellBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setReady(true);
      if (u) {
        setChats(await fetchChats(u.id));
        if (pushSupported()) setShowBell(!(await pushEnabled()));
      }
    });
  }, []);

  const turnOnBell = async () => {
    if (!me || bellBusy) return;
    setBellBusy(true);
    const r = await enablePush(me.id);
    setBellBusy(false);
    if (r === "ok") setShowBell(false);
    else if (r === "denied")
      alert("通知がブロックされています。端末の設定 > 通知 からOneSeaを許可してください。");
  };

  // 30秒ごとに更新
  useEffect(() => {
    if (!me) return;
    const t = setInterval(async () => setChats(await fetchChats(me.id)), 30000);
    return () => clearInterval(t);
  }, [me]);

  return (
    <main className="pb-20">
      <header
        className="flex items-center justify-between px-5 pb-3.5 pt-4"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <h1 className="text-lg font-extrabold tracking-[4px] text-[#f0e6c8]">LINE</h1>
        <span className="text-[11px] tracking-widest text-[#7a9ab4]">メッセージ</span>
      </header>

      {me && showBell && (
        <button
          onClick={turnOnBell}
          disabled={bellBusy}
          className="flex w-full items-center gap-2.5 border-b border-[#e8e0d0] bg-[#fdf8ec] px-4 py-2.5 text-left"
        >
          <span className="text-[18px]">🔔</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-bold text-[#8a6a20]">
              {bellBusy ? "設定中..." : "新着の通知と、アイコンの未読バッジをオンにする"}
            </span>
            <span className="block text-[10px] text-[#b0a070]">
              ホーム画面に追加したOneSeaのアイコンに「③」が出ます（iPhoneはiOS 16.4以降）
            </span>
          </span>
          <span className="flex-shrink-0 rounded-lg bg-[#c8a030] px-3 py-1.5 text-[11.5px] font-extrabold text-white">
            オンにする
          </span>
        </button>
      )}

      {!ready ? null : !me ? (
        <p className="px-5 py-10 text-center text-sm text-[#8a8070]">
          <Link href="/" className="text-[#c94d3a] underline">
            ログイン
          </Link>
          するとメッセージが使えます
        </p>
      ) : chats === null ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
        </div>
      ) : chats.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-4xl">💬</div>
          <p className="mt-3 text-sm leading-relaxed text-[#8a8070]">
            まだトークがありません。
            <br />
            むらびとのマイページの「連絡を取る」から始まります。
          </p>
        </div>
      ) : (
        <div>
          {chats.map((c) => (
            <Link
              key={c.id}
              href={`/line/${c.id}`}
              className="flex items-center gap-3 border-b border-[#f0e9dc] bg-[#fffdf8] px-4 py-3 no-underline active:bg-[#faf4ea]"
            >
              <div className="relative flex-shrink-0">
                {c.partner.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.partner.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                    style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                  >
                    🌿
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14.5px] font-bold text-[#3a3428]">
                    {c.partner.display_name ?? "むらびと"}
                  </span>
                  <span className="num flex-shrink-0 text-[10.5px] text-[#c0b8a8]">
                    {timeLabel(c.lastAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12.5px] text-[#a09888]">
                    {c.lastBody ?? "トークを始めましょう"}
                  </span>
                  {c.unread > 0 && (
                    <span
                      className="flex h-[19px] min-w-[19px] flex-shrink-0 items-center justify-center rounded-full bg-[#e05040] px-1.5 text-[10px] font-bold text-white"
                      style={{ lineHeight: 1 }}
                    >
                      {c.unread > 99 ? "99+" : c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
