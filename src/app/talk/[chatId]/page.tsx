"use client";

import { srcCdn } from "@/lib/images";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { MessageRow, fetchMessages, fetchMessagesSince, sendMessage, markRead } from "@/lib/line";
import type { CotozuteProfile } from "@/lib/cotozute";
import { TalkCall, peekCall } from "@/components/TalkCall";

/** LINE — トーク画面（吹き出し・既読つけ・5秒ポーリング） */
export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  const chatId = params.chatId;
  const [me, setMe] = useState<User | null>(null);
  const [partner, setPartner] = useState<(CotozuteProfile & { id: string }) | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callActive, setCallActive] = useState(0); // 相手が通話ルームにいる人数
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null); // 入力欄(自動で膨らむ)
  const meRef = useRef<User | null>(null);

  /* 通話中かどうかを覗く（7秒ごと・自分が通話中は不要） */
  useEffect(() => {
    if (inCall) return;
    let stop = false;
    const check = () => peekCall(chatId).then((n) => !stop && setCallActive(n));
    check();
    const t = setInterval(check, 7000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [chatId, inCall]);

  const startCall = async () => {
    if (!me) return;
    setInCall(true);
    // まだ誰もいなければ「発信」— 相手のTALKに📞メッセージが届く（未読/プッシュ経由）
    if (callActive === 0) {
      await sendMessage(chatId, me.id, "📞 ビデオ通話をはじめました — TALKを開いて、上の「参加する」からどうぞ");
    }
  };

  const cursorRef = useRef<string | null>(null);
  const tickRef = useRef(0);

  // 初回・6回に1回は全件（既読の反映用）、それ以外は新着だけ増分取得
  const load = useCallback(async () => {
    const full = cursorRef.current === null || tickRef.current % 6 === 0;
    tickRef.current++;
    if (full) {
      const list = await fetchMessages(chatId);
      setMessages(list);
      if (list.length) cursorRef.current = list[list.length - 1].created_at;
    } else {
      const fresh = await fetchMessagesSince(chatId, cursorRef.current!);
      if (fresh.length) {
        cursorRef.current = fresh[fresh.length - 1].created_at;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
      }
    }
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

  // 最下部（最後のメッセージ）へ。初回は瞬間移動 = 開いた瞬間から最新が見える（LINEの秘伝のタレ）
  const didInitScroll = useRef(false);
  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: didInitScroll.current ? "smooth" : "auto", block: "end" });
    didInitScroll.current = true;
  }, [messages.length]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    if (taRef.current) taRef.current.style.height = "auto";
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
        <Link href="/talk" className="text-[15px] font-bold text-[#d4b96a] no-underline">
          ◀
        </Link>
        {partner &&
          (partner.username ? (
            <Link href={`/u/${partner.username}`} className="flex items-center gap-2.5 no-underline">
              {partner.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={srcCdn(partner.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="text-xl"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
              )}
              <span className="text-[15px] font-bold text-[#f0e6c8]">
                {partner.display_name ?? "むらびと"}
              </span>
            </Link>
          ) : (
            <span className="text-[15px] font-bold text-[#f0e6c8]">むらびと</span>
          ))}
        {me && (
          <button
            onClick={startCall}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-[17px]"
            style={{ background: "rgba(212,185,106,.18)", border: "1px solid rgba(212,185,106,.5)" }}
            aria-label="ビデオ通話"
          >
            <img src="/icons/icon-video.webp" alt="" style={{ width: 24, height: 24 }} />
          </button>
        )}
      </header>

      {/* 相手が通話中なら参加バナー */}
      {!inCall && callActive > 0 && (
        <button
          onClick={startCall}
          className="flex items-center justify-center gap-2 py-2.5 text-[13px] font-extrabold text-white"
          style={{ background: "linear-gradient(120deg,#2a9a5a,#1e7a46)" }}
        >
          📞 ビデオ通話中です — タップして参加する
        </button>
      )}

      {/* 通話オーバーレイ */}
      {inCall && me && (
        <TalkCall
          chatId={chatId}
          me={me}
          partnerName={partner?.display_name ?? "むらびと"}
          onClose={() => setInCall(false)}
        />
      )}

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
                {(() => {
                  const parts = String(m.body ?? "").split(/(https?:\/\/[^\s]+)/g);
                  return parts.map((pt, i) =>
                    /^https?:\/\//.test(pt) ? (
                      <a
                        key={i}
                        href={pt.startsWith("https://onesea.vercel.app") ? pt.replace("https://onesea.vercel.app", "") : pt}
                        target={pt.startsWith("https://onesea.vercel.app") ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="font-extrabold underline"
                        style={{ color: "#0a6ab0" }}
                      >
                        こちらです →
                      </a>
                    ) : (
                      // 「こちらです → URL」の形は文言が重複するので、直前の「こちらです →」テキストは削る
                      <span key={i}>{pt.replace(/こちらです\s*→\s*$/, "")}</span>
                    )
                  );
                })()}
              </div>
              {!mine && <span className="text-[9px] text-[#a89e8c]">{time}</span>}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div className="sticky bottom-14 mt-auto flex items-end gap-2 border-t border-[#e5dccb] bg-[#fffdf8] px-3 py-2">
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 112) + "px"; // 行が増えたら入力欄も膨らむ(上限4行ほど)
          }}
          placeholder="メッセージ..."
          rows={1}
          className="hide-scrollbar max-h-28 min-h-[38px] flex-1 resize-none rounded-2xl border border-[#e8dcc4] bg-white px-3.5 py-2 text-[14px] leading-relaxed outline-none focus:border-[#c94d3a]"
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
