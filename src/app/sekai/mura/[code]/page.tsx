"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { PREFS } from "@/lib/sekai";
import { fetchGroupMessages, sendGroupMessage, markGroupRead, fetchGroupReads, type GroupMessageRow } from "@/lib/line";

const GREEN = "#4a9a5a";
const ALL_PREFS = [...PREFS, "海外"] as string[];

/** セカイムラ◯◯県トップ — 県全体チャット(TalK同期) + その県の拠点一覧 + 拠点の申請 */
export default function SekaiMuraPrefPage() {
  const params = useParams<{ code: string }>();
  const idx = parseInt(params.code, 10);
  const pref = ALL_PREFS[idx - 1] ?? "";
  const disp = pref.replace(/[都府県]$/, "");

  const [me, setMe] = useState<User | null>(null);
  const meRef = useRef<User | null>(null);
  const [murabito, setMurabito] = useState(false);
  const [gateChecked, setGateChecked] = useState(false);
  const [joining, setJoining] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [villages, setVillages] = useState<any[]>([]);
  const [messages, setMessages] = useState<GroupMessageRow[]>([]);
  const [reads, setReads] = useState<Array<{ user_id: string; last_read_at: string }>>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [photoSending, setPhotoSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const joinedRef = useRef(false);
  const [kb, setKb] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const f = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", f);
    vv.addEventListener("scroll", f);
    return () => { vv.removeEventListener("resize", f); vv.removeEventListener("scroll", f); };
  }, []);

  const load = useCallback(async (rid: string) => {
    const list = await fetchGroupMessages("pref", rid);
    setMessages(list);
    if (meRef.current) markGroupRead("pref", rid, meRef.current.id);
    fetchGroupReads("pref", rid).then(setReads);
  }, []);

  useEffect(() => {
    if (!pref) return;
    const supabase = createClient();
    // 県のセカイムラ全体チャット部屋
    supabase.from("pref_rooms").select("id").eq("kind", "sekai").eq("prefecture", pref).maybeSingle().then(async ({ data }) => {
      if (!data) return;
      setRoomId(data.id);
      const { count } = await supabase.from("pref_room_members").select("user_id", { count: "exact", head: true }).eq("room_id", data.id);
      setMemberCount(count ?? null);
      load(data.id);
    });
    // この県の拠点(会員数が多い順)
    supabase.from("villages").select("id, name, prefecture, cover_url, icon_url, village_members(count)").then(({ data }) => {
      const list = (data ?? []).filter((v: any) =>
        pref === "海外" ? !PREFS.includes(v.prefecture) : v.prefecture === pref
      );
      list.sort((a: any, b: any) => (b.village_members?.[0]?.count ?? 0) - (a.village_members?.[0]?.count ?? 0));
      setVillages(list);
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      meRef.current = u;
      if (!u) { setGateChecked(true); return; }
      const [{ data: prof }, { data: adm }] = await Promise.all([
        supabase.from("profiles").select("murabito").eq("id", u.id).maybeSingle(),
        supabase.from("talk_admins").select("user_id").eq("user_id", u.id).maybeSingle(),
      ]);
      setMurabito(!!prof?.murabito || !!adm);
      setGateChecked(true);
    });
  }, [pref, load]);

  // 村人がページを開いたら自動参加 → TalKのグループ欄に「セカイムラ◯◯」が現れる
  useEffect(() => {
    if (!me || !roomId || !murabito || joinedRef.current) return;
    joinedRef.current = true;
    const supabase = createClient();
    supabase.from("pref_room_members").upsert({ room_id: roomId, user_id: me.id }).then(() => {});
  }, [me, roomId, murabito]);

  useEffect(() => {
    if (!roomId) return;
    const t = setInterval(() => load(roomId), 5000);
    return () => clearInterval(t);
  }, [roomId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* その場で村人になる(既にモーダルを閉じた人・未回答の人用) */
  const becomeMurabito = async () => {
    if (!me || joining) return;
    setJoining(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ murabito: true }).eq("id", me.id);
    if (error) { alert("うまく登録できませんでした。もう一度お試しください"); setJoining(false); return; }
    if (roomId) await supabase.from("pref_room_members").upsert({ room_id: roomId, user_id: me.id });
    setMurabito(true);
    setJoining(false);
  };

  const sendPhoto = async (f: File) => {
    if (!me || !roomId || photoSending) return;
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
      await load(roomId);
    } catch {
      alert("写真を送れませんでした。通信環境を確認してもう一度どうぞ");
    }
    setPhotoSending(false);
  };

  const submit = async () => {
    if (!me || !roomId || !body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error } = await sendGroupMessage("pref", roomId, me.id, text);
    if (error) {
      setBody(text);
      alert("送信できませんでした。村人になっているかご確認ください");
    }
    setSending(false);
    load(roomId);
  };

  if (!pref) {
    return (
      <main className="min-h-dvh px-6 pt-24 text-center" style={{ background: "#eef4ee" }}>
        <p className="text-[14px] font-bold text-[#5a6a54]">このセカイムラは見つかりませんでした</p>
        <Link href="/sekai/villages" className="mt-4 inline-block text-[13px] font-bold underline" style={{ color: GREEN }}>拠点トップへ戻る</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col lg:max-w-3xl" style={{ background: "#eef4ee", paddingBottom: kb > 0 ? kb + 64 : 120 }}>
      {/* 村人ではない人へのご案内 */}
      {gateChecked && me && !murabito && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 text-center">
            <div className="text-[36px]">🏡</div>
            <h2 className="mt-2 text-[16px] font-extrabold text-[#1e4530]">ここはセカイムラ{disp}の村</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5a6a54]">県のみんなの全体チャットは、セカイムラの村人だけが参加できます。村人になるとマイページに🌾ムラビトバッジが付きます（無料）。</p>
            <button onClick={becomeMurabito} disabled={joining} className="mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40" style={{ background: GREEN }}>
              {joining ? "登録中..." : "🌾 村人になる"}
            </button>
            <Link href="/sekai/villages" className="mt-2 block py-2 text-[12px] font-bold text-[#a09a88] no-underline">拠点トップへ戻る</Link>
          </div>
        </div>
      )}

      {/* ヘッダー */}
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5" style={{ background: "linear-gradient(150deg,#2a7a48,#1e4530)" }}>
        <Link href="/sekai/villages" className="text-[15px] font-bold text-[#cfe8d0] no-underline">◀</Link>
        <span className="text-[20px]">🏡</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold leading-tight text-white">セカイムラ{disp}</div>
          {memberCount != null && <div className="num text-[10px] text-[#a8d4b0]">{memberCount}人の村人 ・ TalKのグループと同期中</div>}
        </div>
        {roomId && <a href={`/talk/g/pref/${roomId}`} className="flex-shrink-0 text-[11px] text-[#a8d4b0] no-underline">TalKで開く →</a>}
      </header>

      {/* この県の拠点 */}
      <section className="px-3 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[12px] font-extrabold text-[#2a4a34]">
            <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> {disp}の拠点（{villages.length}）
          </div>
          <Link
            href={`/sekai/villages?pref=${encodeURIComponent(pref)}#seed-sec`}
            className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white no-underline"
            style={{ background: GREEN }}
          >
            ＋ 拠点の申請
          </Link>
        </div>
        {villages.length === 0 ? (
          <p className="rounded-xl bg-white px-3 py-3 text-[11.5px] leading-relaxed text-[#8a9a84]">
            {disp}にはまだ拠点がありません。最初の拠点を立ち上げてみませんか？
          </p>
        ) : (
          <div className="hide-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1" data-noswipe>
            {villages.map((v: any) => (
              <Link key={v.id} href={`/sekai/village/${v.id}`} className="w-[128px] flex-shrink-0 overflow-hidden rounded-xl border border-[#d8e4d0] bg-white no-underline">
                <div className="h-[64px] bg-[#eaf2ea]">
                  {v.cover_url
                    ? <img src={srcCdn(v.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-[20px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>🏡</div>}
                </div>
                <div className="px-2 py-1.5">
                  <div className="truncate text-[10.5px] font-extrabold text-[#2a4a34]">{v.name}</div>
                  <div className="num text-[9px] text-[#8a9a84]">{v.village_members?.[0]?.count ?? 0}人</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 県全体チャット */}
      <div className="mt-2 px-3 text-[12px] font-extrabold text-[#2a4a34]">💬 セカイムラ{disp} 全体チャット</div>
      <div className="flex-1 space-y-2.5 px-3 py-3">
        {messages.length === 0 && (
          <p className="py-10 text-center text-[12.5px] leading-relaxed text-[#8a9a84]">
            まだ書き込みがありません。<br />セカイムラ{disp}のみなさん、ひとこと目をどうぞ🏡
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
                : <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#dcead8] text-[13px]">🏡</span>}
              <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                <div className={`text-[10px] text-[#8a9a84] ${mine ? "pr-1" : "pl-1"}`}>{mine && kidoku > 0 ? `既読${kidoku} ・ ` : ""}{prof?.display_name ?? "むらびと"} ・ {time}</div>
                <div className={`mt-0.5 inline-block rounded-2xl px-3.5 py-2 text-left text-[13.5px] leading-relaxed ${mine ? "text-white" : "bg-white text-[#3a4438]"}`} style={mine ? { background: GREEN } : { border: "1px solid #dce8d8" }}>
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
      <div className="fixed left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-3 pb-3 lg:max-w-3xl" style={{ bottom: kb > 0 ? kb : 8 }}>
        {me ? (
          <div className="flex items-end gap-2 rounded-2xl bg-white p-2" style={{ border: "1px solid #cfe0cc", boxShadow: "0 4px 16px rgba(30,69,48,.12)" }}>
            <label className="flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#eef4ee] text-[18px]">
              📷
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.currentTarget.value = ""; }} />
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={1}
              placeholder={`セカイムラ${disp}のみんなに書き込む...`}
              className="hide-scrollbar max-h-28 min-h-[38px] flex-1 resize-none rounded-xl bg-transparent px-2 py-2 text-[14px] text-[#3a4438] outline-none placeholder:text-[#a0b09a]"
            />
            <button onClick={submit} disabled={!body.trim() || sending} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[16px] font-bold text-white disabled:opacity-40" style={{ background: GREEN }}>➤</button>
          </div>
        ) : (
          <Link href="/" className="block rounded-2xl py-3 text-center text-[13px] font-bold text-white no-underline" style={{ background: GREEN }}>ログインして参加する</Link>
        )}
      </div>
    </main>
  );
}
