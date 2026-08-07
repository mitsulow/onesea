"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  BroadcastRow,
  fetchBroadcasts,
  isTalkAdmin,
  markBroadcastRead,
  sendBroadcast,
} from "@/lib/line";

/* eslint-disable @next/next/no-img-element */

/** 📢 事務局からのお知らせ — 事務局3アカウントだけが全員へ送れるTALK */
export default function BroadcastPage() {
  const [me, setMe] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [messages, setMessages] = useState<BroadcastRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<User | null>(null);

  const load = useCallback(async () => {
    const list = await fetchBroadcasts();
    setMessages(list);
    if (meRef.current) markBroadcastRead(meRef.current.id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (!u) return;
      isTalkAdmin(u.id).then(setAdmin);
      load();
    });
  }, [load]);

  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    await sendBroadcast(me.id, text);
    setSending(false);
    load();
  };

  return (
    <main className="flex min-h-screen flex-col pb-14">
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/talk" className="text-[15px] font-bold text-[#d4b96a] no-underline">
          ◀
        </Link>
        <img src="/icons/icon-megaphone.webp" alt="" style={{ width: 22, height: 22 }} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight text-[#f0e6c8]">事務局からのお知らせ</div>
          <div className="text-[10px] text-[#7a9ab4]">OneSea全員に届く公式TALK</div>
        </div>
      </header>

      <div className="flex-1 space-y-2.5 bg-[#ece5d8] px-3 py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-[12px] text-[#a89e8c]">
            まだお知らせはありません。
          </p>
        )}
        {messages.map((m) => {
          const d = new Date(m.created_at);
          const date = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          return (
            <div key={m.id} className="flex items-end gap-1.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center self-start rounded-full bg-[#17384e] text-[14px]">
                <img src="/icons/icon-megaphone.webp" alt="" style={{ width: 26, height: 26 }} />
              </span>
              <div className="max-w-[80%]">
                <div className="mb-0.5 pl-1 text-[10px] text-[#8a8070]">
                  {m.profiles?.display_name ?? "OneSea事務局"}
                </div>
                <div className="flex items-end gap-1.5">
                  <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-[#d4b96a]/40 bg-[#fffbef] px-3.5 py-2 text-[14px] leading-relaxed text-[#3a3428]">
                    {m.body}
                  </div>
                  <span className="flex-shrink-0 text-[9px] text-[#a89e8c]">{date}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {admin ? (
        <div className="sticky bottom-14 border-t border-[#e5dccb] bg-[#fffdf8] px-3 py-2">
          <div className="mb-1 text-[10px] font-bold text-[#c94d3a]">
            事務局として全員に送ります（全員にプッシュ通知が届きます）
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="全員へのお知らせ..."
              rows={1}
              className="max-h-28 min-h-[38px] flex-1 resize-none rounded-2xl border border-[#e8dcc4] bg-white px-3.5 py-2 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
            />
            <button
              onClick={submit}
              disabled={!body.trim() || sending}
              aria-label="送信"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40"
              style={{ background: "#c94d3a" }}
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-14 border-t border-[#e5dccb] bg-[#f5efe2] px-3 py-2.5 text-center text-[11px] text-[#a89e8c]">
          お知らせの送信は事務局アカウントのみ
        </div>
      )}
    </main>
  );
}
