"use client";

import { srcCdn } from "@/lib/images";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { GroupMessageRow, fetchGroupMessages, sendGroupMessage, markGroupRead, fetchGroupReads } from "@/lib/line";

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
  const [reads, setReads] = useState<Array<{ user_id: string; last_read_at: string }>>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null); // 入力欄(自動で膨らむ)
  const draftKey = "talk-draft:g:" + String(params.type) + ":" + String(params.id);
  useEffect(() => {
    try {
      const d = localStorage.getItem(draftKey);
      if (d) setBody(d);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (body) localStorage.setItem(draftKey, body);
      else localStorage.removeItem(draftKey);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);
  const [photoPick, setPhotoPick] = useState(false); // 📷の2択シート
  const [photoSending, setPhotoSending] = useState(false);
  const camInput = useRef<HTMLInputElement | null>(null);
  const albInput = useRef<HTMLInputElement | null>(null);
  /** 写真を強圧縮(長辺1280px/WebP)してR2へ→メッセージ送信。表示はR2直なのでうちの転送料ゼロ */
  const sendPhoto = async (f: File) => {
    if (!me || photoSending) return;
    setPhotoSending(true);
    try {
      const { compressImage } = await import("@/lib/images");
      const blob = await compressImage(f, 1280, 0.55);
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("folder", "talk");
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.url) throw new Error(d.error ?? "upload");
      await sendGroupMessage(String(params.type), String(params.id), me.id, "📷 写真", d.url);
      await load();
    } catch {
      alert("写真を送れませんでした。通信環境を確認してもう一度どうぞ");
    }
    setPhotoSending(false);
  };

  const [kb, setKb] = useState(0); // ソフトキーボードの高さ(入力欄をその真上に貼り付ける)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => {
      vv.removeEventListener("resize", f);
      vv.removeEventListener("scroll", f);
    };
  }, []);
  const meRef = useRef<User | null>(null);

  const load = useCallback(async () => {
    const list = await fetchGroupMessages(type, id);
    setMessages(list);
    if (meRef.current) markGroupRead(type, id, meRef.current.id);
    fetchGroupReads(type, id).then(setReads);
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
          supabase.from("neura_teams").select("name, prefecture, city").eq("id", id).maybeSingle(),
          supabase.from("neura_members").select("user_id", { count: "exact", head: true }).eq("team_id", id),
        ]);
        setName((t as any)?.name ?? `ニューラ班（${t?.city ?? t?.prefecture ?? ""}）`);
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
      } else if (type === "pref") {
        const [{ data: pf }, { count }] = await Promise.all([
          supabase.from("pref_rooms").select("prefecture").eq("id", id).maybeSingle(),
          supabase.from("pref_room_members").select("user_id", { count: "exact", head: true }).eq("room_id", id),
        ]);
        if (pf?.prefecture) setName(`${pf.prefecture}交流`);
        setEmoji("🗾");
        setMemberCount(count ?? null);
      } else if (type === "tanbo") {
        const [{ data: tb }, { count }] = await Promise.all([
          supabase.from("tanbo").select("name").eq("id", id).maybeSingle(),
          supabase.from("tanbo_members").select("user_id", { count: "exact", head: true }).eq("tanbo_id", id),
        ]);
        if (tb?.name) setName(tb.name);
        setEmoji("🌾");
        setMemberCount(count ?? null);
      } else if (type === "moai") {
        const [{ data: mo }, { count }] = await Promise.all([
          supabase.from("moai").select("name").eq("id", id).maybeSingle(),
          supabase.from("moai_members").select("user_id", { count: "exact", head: true }).eq("moai_id", id).eq("status", "approved"),
        ]);
        if (mo?.name) setName(mo.name);
        setEmoji("🗿");
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
    if (taRef.current) taRef.current.style.height = "auto";
    await sendGroupMessage(type, id, me.id, text);
    setSending(false);
    load();
  };

  return (
    <main className="flex min-h-screen flex-col pb-32">
      {/* ヘッダー */}
      <header
        className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <Link href="/talk" className="text-[15px] font-bold text-[#d4b96a] no-underline">
          ◀
        </Link>
        <span className="text-[20px]">{emoji === "🧠" ? <img src="/icons/icon-neura-red.webp" alt="" style={{ width: 22, height: 22 }} /> : emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight text-[#f0e6c8]">{name}</div>
          {memberCount != null && <div className="num text-[10px] text-[#7a9ab4]">{memberCount}人のグループ</div>}
        </div>
        {type !== "neura" && (
          <Link
            href={type === "village" ? `/sekai/village/${id}` : type === "moai" ? `/moai/${id}` : type === "tanbo" ? `/sekai/kome/${id}` : type === "pref" ? `/mmm/kouryu/${id}` : `/sekai/club/${id}`}
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
          const kidoku = mine ? reads.filter((r) => r.user_id !== me?.id && r.last_read_at >= m.created_at).length : 0;
          return (
            <div key={m.id} className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
              {!mine &&
                (m.profiles?.username ? (
                  <Link href={`/u/${m.profiles.username}`} className="flex-shrink-0 self-start">
                    {m.profiles?.avatar_url ? (
                      <img
                        src={srcCdn(m.profiles.avatar_url)}
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
                  {mine && <span className="text-[9px] text-[#a89e8c]">{kidoku > 0 ? `既読${kidoku} ` : ""}{time}</span>}
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed ${
                      mine ? "rounded-br-md bg-[#8de055] text-[#1a2a10]" : "rounded-bl-md bg-white text-[#3a3428]"
                    }`}
                  >
                    {(m as any).image_url && (
                      <a href={(m as any).image_url} target="_blank" rel="noopener">
                        <img src={(m as any).image_url} alt="" loading="lazy" className="mb-1 max-h-[280px] w-full rounded-xl object-contain" style={{ maxWidth: 220 }} />
                      </a>
                    )}
                    {(m as any).image_url && m.body === "📷 写真" ? null : m.body}
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
      <div className="fixed inset-x-0 z-40 flex items-end gap-2 border-t border-[#e5dccb] bg-[#fffdf8] px-3 py-2" style={{ bottom: kb > 0 ? kb : 56 }}>
        {/* 📷 写真(LINE式・R2直行でうちの転送料ゼロ) */}
        <button
          onClick={() => setPhotoPick(true)}
          disabled={photoSending}
          aria-label="写真を送る"
          className="flex h-10 w-8 flex-shrink-0 items-center justify-center text-[20px] disabled:opacity-40"
        >
          {photoSending ? "⏳" : "📷"}
        </button>
        <input
          ref={camInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendPhoto(f);
          }}
        />
        <input
          ref={albInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendPhoto(f);
          }}
        />
        <textarea
          ref={taRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 112) + "px"; // 行が増えたら入力欄も膨らむ(上限4行ほど)
          }}
          placeholder="みんなへメッセージ..."
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
      {/* 写真の出どころ2択 */}
      {photoPick && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/45" onClick={() => setPhotoPick(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#ddd]" />
            <button
              onClick={() => {
                setPhotoPick(false);
                camInput.current?.click();
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border-2 border-[#c8dccb] bg-[#f4faf5] px-4 py-3.5 text-left text-[14px] font-extrabold text-[#2a5a3a]"
            >
              📷 カメラで撮る
            </button>
            <button
              onClick={() => {
                setPhotoPick(false);
                albInput.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-[#c8d4e8] bg-[#f4f8ff] px-4 py-3.5 text-left text-[14px] font-extrabold text-[#2a4a7a]"
            >
              🖼 アルバムから選ぶ
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
