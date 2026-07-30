"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { MessageRow, fetchMessages, sendMessage, markRead } from "@/lib/line";
import type { CotozuteProfile } from "@/lib/cotozute";

/** LINE — トーク画面（吹き出し・既読つけ・5秒ポーリング） */
export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;
  const [me, setMe] = useState<User | null>(null);
  const [partner, setPartner] = useState<(CotozuteProfile & { id: string }) | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<User | null>(null);

  const load = useCallback(async () => {
    const list = await fetchMessages(chatId);
    setMessages(list);
    if (meRef.current) markRead(chatId, meRef.current.id);
  }, [chatId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (!u) return;
      // 相手を特定
      const { data: chat } = await supabase
        .from("chats")
        .select(
          "a, b, pa:profiles!chats_a_fkey(username, display_name, avatar_url), pb:profiles!chats_b_fkey(username, display_name, avatar_url)"
        )
        .eq("id", chatId)
        .maybeSingle();
      if (chat) {
        const partnerIsA = chat.b === u.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (partnerIsA ? chat.pa : chat.pb) as any;
        setPartner({ ...(p ?? { username: null, display_name: "むらびと", avatar_url: null }), id: partnerIsA ? chat.a : chat.b });
      }
      load();
    });
  }, [chatId, load]);

  // 5秒ポーリング
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // 新着で最下部へ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    await sendMessage(chatId, me.id, text);
    setSending(false);
    load();
  };

  return (
    <main className="flex min-h-screen flex-col pb-14">
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/line" className="text-[15px] font-bold text-[#d4b96a] no-underline">
          ◀
        </Link>
        {partner &&
          (partner.username ? (
            <Link href={`/u/${partner.username}`} className="flex items-center gap-2.5 no-underline">
              {partner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={partner.avatar_url} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="text-xl">🌿</span>
              )}
              <span className="text-[15px] font-bold text-[#f0e6c8]">
                {partner.display_name ?? "むらびと"}
              </span>
            </Link>
          ) : (
            <span className="text-[15px] font-bold text-[#f0e6c8]">むらびと</span>
          ))}
      </header>

      {/* メッセージ */}
      <div className="flex-1 space-y-2 bg-[#ece5d8] px-3 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === me?.id;
          const d = new Date(m.created_at);
          const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {mine && (
                <span className="text-[9px] leading-tight text-[#a89e8c]">
                  {m.read_at ? "既読" : ""}
                  <br />
                  {time}
                </span>
              )}
              <div
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                  mine ? "rounded-br-md bg-[#8de055] text-[#1a2a10]" : "rounded-bl-md bg-white text-[#3a3428]"
                }`}
              >
                {m.body}
              </div>
              {!mine && <span className="text-[9px] text-[#a89e8c]">{time}</span>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="sticky bottom-14 flex items-end gap-2 border-t border-[#e5dccb] bg-[#fffdf8] px-3 py-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="メッセージ..."
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
    </main>
  );
}
