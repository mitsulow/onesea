"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { GroupMessageRow, fetchGroupMessages, sendGroupMessage, markGroupRead } from "@/lib/line";

/* eslint-disable @next/next/no-img-element */

/** グループLINE — 村・部活のトークルーム（相手の名前つき吹き出し・5秒ポーリング） */
export default function GroupChatPage() {
  const params = useParams<{ type: string; id: string }>();
  const type = params.type;
  const id = params.id;
  const [me, setMe] = useState<User | null>(null);
  const [name, setName] = useState("グループ");
  const [emoji, setEmoji] = useState("👥");
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<User | null>(null);

  const load = useCallback(async () => {
    const list = await fetchGroupMessages(type, id);
    setMessages(list);
    if (meRef.current) markGroupRead(type, id, meRef.current.id);
  }, [type, id]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (!u) return;
      if (type === "neura") {
        const [{ data: t }, { count }] = await Promise.all([
          supabase.from("neura_teams").select("prefecture, city").eq("id", id).maybeSingle(),
          supabase.from("neura_members").select("user_id", { count: "exact", head: true }).eq("team_id", id),
        ]);
        setName(`ニューラ班（${t?.city ?? t?.prefecture ?? ""}）`);
        setEmoji("🧠");
        setMemberCount(count ?? null);
      } else if (type === "village") {
        const [{ data: v }, { count }] = await Promise.all([
          supabase.from("villages").select("name").eq("id", id).maybeSingle(),
          supabase.from("village_members").select("user_id", { count: "exact", head: true }).eq("village_id", id),
        ]);
        if (v?.name) setName(v.name);
        setEmoji("⛺");
        setMemberCount(count ?? null);
      } else {
        const [{ data: c }, { count }] = await Promise.all([
          supabase.from("clubs").select("name, emoji").eq("id", id).maybeSingle(),
          supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", id),
        ]);
        if (c?.name) setName(c.name);
        setEmoji(c?.emoji ?? "🎌");
        setMemberCount(count ?? null);
      }
      load();
    });
  }, [type, id, load]);

  useEffect(() => {
    const t = setInterval(load, 5000);
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
    await sendGroupMessage(type, id, me.id, text);
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
        <span className="text-[20px]">{emoji === "🧠" ? <img src="/icons/icon-neura5.webp" alt="" style={{ width: 22, height: 22 }} /> : emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight text-[#f0e6c8]">{name}</div>
          {memberCount != null && <div className="num text-[10px] text-[#7a9ab4]">{memberCount}人のグループ</div>}
        </div>
        {type !== "neura" && (
          <Link
            href={type === "village" ? `/sekai/village/${id}` : `/sekai/club/${id}`}
            className="flex-shrink-0 text-[11px] text-[#7a9ab4] no-underline"
          >
            詳細 →
          </Link>
        )}
      </header>

      {/* メッセージ */}
      <div className="flex-1 space-y-2.5 bg-[#ece5d8] px-3 py-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-[12px] text-[#a89e8c]">
            まだメッセージがありません。
            <br />
            ひとこと目をどうぞ 🌱
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me?.id;
          const d = new Date(m.created_at);
          const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine &&
                (m.profiles?.username ? (
                  <Link href={`/u/${m.profiles.username}`} className="flex-shrink-0 self-start">
                    {m.profiles?.avatar_url ? (
                      <img
                        src={m.profiles.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#cfe0d4] text-[14px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
                    )}
                  </Link>
                ) : (
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center self-start rounded-full bg-[#cfe0d4] text-[14px]">
                    <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
                  </span>
                ))}
              <div className={`max-w-[72%] ${mine ? "" : ""}`}>
                {!mine && (
                  <div className="mb-0.5 pl-1 text-[10px] text-[#8a8070]">{m.profiles?.display_name ?? "むらびと"}</div>
                )}
                <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : ""}`}>
                  {mine && <span className="text-[9px] text-[#a89e8c]">{time}</span>}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                      mine ? "rounded-br-md bg-[#8de055] text-[#1a2a10]" : "rounded-bl-md bg-white text-[#3a3428]"
                    }`}
                  >
                    {m.body}
                  </div>
                  {!mine && <span className="text-[9px] text-[#a89e8c]">{time}</span>}
                </div>
              </div>
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
          placeholder="みんなへメッセージ..."
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
