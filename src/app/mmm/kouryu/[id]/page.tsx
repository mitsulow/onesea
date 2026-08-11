"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { fetchGroupMessages, fetchGroupMessagesSince, sendGroupMessage, markGroupRead, fetchGroupReads, type GroupMessageRow } from "@/lib/line";

const GOLD = "#d4b96a";

/** 県別交流チャット — TalKのグループ「◯◯県交流」と完全同期(同じテーブル) */
export default function KouryuRoomPage() {
  const [isWara, setIsWara] = useState(false);
  const [waraChecked, setWaraChecked] = useState(false);

  const params = useParams<{ id: string }>();
  const roomId = params.id;
  const [me, setMe] = useState<User | null>(null);
  const meRef = useRef<User | null>(null);
  const [pref, setPref] = useState("");
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [reads, setReads] = useState<Array<{ user_id: string; last_read_at: string }>>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [photoSending, setPhotoSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const joinedRef = useRef(false);

  // キーボード追従
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const uid = session?.user?.id;
      if (!uid) { setIsWara(false); setWaraChecked(true); return; }
      const [{ data: prof }, { data: adm }] = await Promise.all([
        supabase.from("profiles").select("warawa_until").eq("id", uid).maybeSingle(),
        supabase.from("talk_admins").select("user_id").eq("user_id", uid).maybeSingle(),
      ]);
      const { isWarawaUntil } = await import("@/lib/warawa");
      setIsWara(!!adm || isWarawaUntil(prof?.warawa_until as string | null));
      setWaraChecked(true);
    });
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); };
  }, []);

  const load = useCallback(async () => {
    const list = await fetchGroupMessages("pref", roomId);
    setMessages(list);
    lastAtRef.current = list.length ? list[list.length - 1].created_at : new Date(0).toISOString();
    if (meRef.current) markGroupRead("pref", roomId, meRef.current.id);
    fetchGroupReads("pref", roomId).then(setReads);
  }, [roomId]);

  const lastAtRef = useRef<string | null>(null);
  /* 5秒ごとの見張りは「新着だけ」を取る(全件再取得はパケとSupabase転送を食うのでやめた) */
  const poll = useCallback(async () => {
    const since = lastAtRef.current;
    if (!since) { load(); return; }
    const news = await fetchGroupMessagesSince("pref", roomId, since);
    if (news.length) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const add = news.filter((m) => !seen.has(m.id));
        if (!add.length) return prev;
        lastAtRef.current = add[add.length - 1].created_at;
        return [...prev, ...add];
      });
      if (meRef.current) markGroupRead("pref", roomId, meRef.current.id);
      fetchGroupReads("pref", roomId).then(setReads);
    }
  }, [roomId, load]);


  useEffect(() => {
    const supabase = createClient();
    supabase.from("pref_rooms").select("prefecture").eq("id", roomId).maybeSingle().then(({ data }) => setPref(data?.prefecture ?? ""));
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (u && !joinedRef.current) {
        joinedRef.current = true;
        // ルームを開いたら自動参加 → TalKのグループ欄にも現れる
        await supabase.from("pref_room_members").upsert({ room_id: roomId, user_id: u.id });
      }
      const { count } = await supabase.from("pref_room_members").select("user_id", { count: "exact", head: true }).eq("room_id", roomId);
      setMemberCount(count ?? null);
      load();
    });
  }, [roomId, load]);

  useEffect(() => {
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* 写真送信(TalKと同じ: 圧縮→R2直行→転送料ゼロ) */
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
      await sendGroupMessage("pref", roomId, me.id, "📷 写真", d.url);
      await load();
    } catch {
      alert("写真を送れませんでした。通信環境を確認してもう一度どうぞ");
    }
    setPhotoSending(false);
  };

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error } = await sendGroupMessage("pref", roomId, me.id, text);
    if (error) {
      setBody(text);
      alert("送信できませんでした。通信環境を確認してもう一度どうぞ");
    }
    setSending(false);
    load();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col lg:max-w-3xl" style={{ background: "#0e1e2e", paddingBottom: kb > 0 ? kb + 64 : 120 }}>
      
      {waraChecked && !isWara && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 text-center">
            <div className="text-[36px]">🗾</div>
            <h2 className="mt-2 text-[16px] font-extrabold text-[#1c3448]">県別の交流は、わらわ〜会員のひろばです</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5a6a74]">同じ県の仲間との交流チャットは、有料のわらわ〜会員だけが使えます。わらわ〜会員になってご参加ください。</p>
            <a href="https://warawer.com" className="mt-4 block rounded-xl py-3 text-[13.5px] font-extrabold text-white no-underline" style={{ background: "#d4b96a", color: "#1c2432" }}>わらわ〜会員について →</a>
            <Link href="/mmm" className="mt-2 block py-2 text-[12px] font-bold text-[#8a9aa8] no-underline">MMMトップへ戻る</Link>
          </div>
        </div>
      )}
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5" style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}>
        <Link href="/mmm/kouryu" className="text-[15px] font-bold no-underline" style={{ color: GOLD }}>◀</Link>
        <span className="text-[20px]">🗾</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight text-[#f0e6c8]">{pref}交流</div>
          {memberCount != null && <div className="num text-[10px] text-[#7a9ab4]">{memberCount}人 ・ TalKのグループと同期中</div>}
        </div>
        <a href={`/talk/g/pref/${roomId}`} className="flex-shrink-0 text-[11px] text-[#7a9ab4] no-underline">TalKで開く →</a>
      </header>

      {/* メッセージ(掲示板×チャット) */}
      <div className="flex-1 space-y-2.5 px-3 py-4">
        {messages.length === 0 && (
          <p className="py-10 text-center text-[12.5px] leading-relaxed text-[#5a7a94]">
            まだ書き込みがありません。<br />{pref}のみなさん、ひとこと目をどうぞ🗾
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === me?.id;
          const d = new Date(m.created_at);
          const time = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
          const kidoku = mine ? reads.filter((r) => r.user_id !== me?.id && r.last_read_at >= m.created_at).length : 0;
          const prof = (m as any).profiles;
          return (
            <div key={m.id} className={`flex items-start gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {prof?.avatar_url
                ? <img src={srcCdn(prof.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                : <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1e3a52] text-[13px]">🗾</span>}
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                <div className={`text-[10px] text-[#5a7a94] ${mine ? "pr-1" : "pl-1"}`}>{mine && kidoku > 0 ? `既読${kidoku} ・ ` : ""}{prof?.display_name ?? "むらびと"} ・ {time}</div>
                <div className={`mt-0.5 inline-block rounded-2xl px-3.5 py-2 text-left text-[13.5px] leading-relaxed ${mine ? "text-[#0e1e2e]" : "bg-[#1e3a52] text-[#e8f0f8]"}`} style={mine ? { background: GOLD } : undefined}>
                  {(m as any).image_url && <img src={srcCdn((m as any).image_url)} alt="" className="mb-1 max-w-[200px] rounded-lg" />}
                  {m.body === "📷 写真" && (m as any).image_url ? "" : m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {photoSending && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/60">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/30 border-t-white" />
          <p className="mt-3 text-[13px] font-bold text-white">写真を送信中...</p>
        </div>
      )}

      {/* 入力欄(下固定・キーボード追従) */}
      <div className="fixed left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3 pb-3 lg:max-w-3xl" style={{ bottom: kb > 0 ? kb : 56 }}>
        {me ? (
          <div className="flex items-end gap-2 rounded-2xl p-2" style={{ background: "#17384e", border: "1px solid #2a4a63" }}>
            <label className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full text-[18px]" style={{ background: "#1e3a52" }}>
              📷
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.currentTarget.value = ""; }} />
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={1}
              placeholder={`${pref}のみんなに書き込む...`}
              className="hide-scrollbar max-h-28 min-h-[38px] flex-1 resize-none rounded-xl bg-transparent px-2 py-2 text-[14px] text-[#e8f0f8] outline-none placeholder:text-[#5a7a94]"
            />
            <button onClick={submit} disabled={!body.trim() || sending} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-[#0e1e2e] disabled:opacity-40" style={{ background: GOLD }}>➤</button>
          </div>
        ) : (
          <Link href="/" className="block rounded-2xl py-3 text-center text-[13px] font-bold text-[#0e1e2e] no-underline" style={{ background: GOLD }}>ログインして参加する</Link>
        )}
      </div>
    </main>
  );
}
