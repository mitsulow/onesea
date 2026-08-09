"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";
import { PlaceOverlay, type PlaceInfo } from "@/components/PlaceOverlay";
import { fetchTanboPage, joinTanbo, leaveTanbo, fetchTanboMemberIds, fetchTanboMembers, updateTanboPage, deleteTanboPage, fetchTanboComments, addTanboComment, type TanboPage } from "@/lib/tanbo";
import { readTecho, writeTecho } from "@/lib/techoStore";
import { fetchGroupMessages, sendGroupMessage } from "@/lib/line";
import { PREFS } from "@/lib/sekai";

const YOBI = ["日", "月", "火", "水", "木", "金", "土"];
const G = "#2a7a48"; // 米部の緑

/** 田んぼのページ — 拠点・MOAIサークルと同じ「ページ」構造(FEED/MEMBERS/CHAT) */
export default function TanboDetailPage() {
  const params = useParams<{ id: string }>();
  const tanboId = params.id;
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [tanbo, setTanbo] = useState<TanboPage | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [memberProfs, setMemberProfs] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [cDraft, setCDraft] = useState<Record<string, string>>({});
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [tab, setTab] = useState<"feed" | "members" | "chat">("feed");
  const joined = !!me && members.has(me.id);
  const isOwner = !!me && tanbo?.user_id === me.id;
  const [amAdmin, setAmAdmin] = useState(false);
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmAdmin)).catch(() => {});
  }, [me]);
  const canManage = isOwner || amAdmin;

  // 投稿シート
  const [sheet, setSheet] = useState<null | "report" | "event">(null);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [evAt, setEvAt] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [editEvId, setEditEvId] = useState<string | null>(null);
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [evPlace, setEvPlace] = useState<{ name: string | null; lat: number | null; lng: number | null; url: string; image: string | null } | null>(null);
  const [evPaste, setEvPaste] = useState("");
  const [evPlaceBusy, setEvPlaceBusy] = useState(false);
  const [evPlaceMsg, setEvPlaceMsg] = useState<string | null>(null);

  // チャット
  const [chat, setChat] = useState<any[]>([]);
  const [chatBody, setChatBody] = useState("");

  // 編集シート
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState("");
  const [ePref, setEPref] = useState("東京都");
  const [eNote, setENote] = useState("");

  const resolveEvPlace = async (raw: string) => {
    const mm = raw.match(/https?:\/\/[^\s]+/);
    if (!mm || evPlaceBusy) return;
    const url = mm[0];
    const hint = raw.replace(url, "").replace(/[\n\r"']+/g, " ").trim().slice(0, 100);
    setEvPlaceBusy(true); setEvPlaceMsg(null);
    try {
      const r = await fetch("/api/reco/resolve?url=" + encodeURIComponent(url) + (hint ? "&hint=" + encodeURIComponent(hint) : ""));
      const d = await r.json();
      if (!r.ok || (!d.name && d.lat == null)) setEvPlaceMsg("リンクを読めませんでした。Googleマップ/検索の共有リンクを貼ってください");
      else if (d.lat == null || d.lng == null) setEvPlaceMsg("場所（座標）が読めませんでした。Googleマップアプリの共有→リンクをコピーが確実です");
      else { setEvPlace({ name: d.name ?? null, lat: d.lat, lng: d.lng, url, image: d.image ?? null }); setEvPaste(""); }
    } catch { setEvPlaceMsg("通信に失敗しました"); }
    setEvPlaceBusy(false);
  };

  const load = useCallback(async () => {
    const [t, mem] = await Promise.all([fetchTanboPage(tanboId), fetchTanboMemberIds(tanboId)]);
    setTanbo(t);
    setMembers(mem);
    fetchTanboMembers(tanboId).then(setMemberProfs);
    const supabase = createClient();
    const { data: ps } = await supabase
      .from("tanbo_posts")
      .select("id, body, photo_url, kind, event_at, event_end, place_name, place_lat, place_lng, place_url, created_at, user_id, profiles!tanbo_posts_user_id_fkey(username, display_name, avatar_url)")
      .eq("tanbo_id", tanboId)
      .order("created_at", { ascending: false })
      .limit(50);
    const all = ps ?? [];
    setPosts(all.filter((p: any) => p.kind !== "event"));
    setEvents(all.filter((p: any) => p.kind === "event" && p.event_at && new Date(p.event_at) >= new Date(Date.now() - 3 * 3600e3)).sort((a: any, b: any) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()));
    fetchTanboComments(all.map((x: any) => x.id)).then(setComments);
    fetchGroupMessages("tanbo", tanboId).then((r) => setChat(r.slice(-30)));
  }, [tanboId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    load();
  }, [load]);

  const toggleJoin = async () => {
    if (!me) { alert("ログインすると参加できます（無料のGoogleログイン）"); return; }
    if (joined) {
      if (!confirm("この田んぼから抜けますか？")) return;
      await leaveTanbo(tanboId, me.id);
    } else {
      await joinTanbo(tanboId, me.id);
    }
    load();
  };

  const changeImage = async (which: "icon" | "cover", f: File | null) => {
    if (!f || !me) return;
    const url = await uploadImage("post-images", me.id, f, which === "cover" ? 1600 : 512, which === "cover" ? 0.75 : 0.8);
    if (url) {
      await createClient().from("tanbo").update({ [which === "cover" ? "cover_url" : "icon_url"]: url }).eq("id", tanboId);
      load();
    }
  };

  const publish = async () => {
    if (!me || !body.trim() || saving) return;
    setSaving(true);
    const supabase = createClient();
    const isEvent = sheet === "event";
    let placeNow = evPlace;
    if (isEvent && !placeNow && /https?:\/\//.test(evPaste)) placeNow = await (async () => { await resolveEvPlace(evPaste); return evPlace; })();
    const payload = {
      body: body.trim(),
      photo_url: photo,
      kind: isEvent ? "event" : "normal",
      event_at: isEvent && evAt ? new Date(evAt).toISOString() : null,
      event_end: isEvent && evEnd ? new Date(evEnd).toISOString() : null,
      place_name: isEvent ? placeNow?.name ?? null : null,
      place_lat: isEvent ? placeNow?.lat ?? null : null,
      place_lng: isEvent ? placeNow?.lng ?? null : null,
      place_url: isEvent ? placeNow?.url ?? null : null,
    };
    const editId = editEvId || editPostId;
    if (editId) await supabase.from("tanbo_posts").update(payload).eq("id", editId);
    else await supabase.from("tanbo_posts").insert({ tanbo_id: tanboId, user_id: me.id, ...payload });
    setSaving(false);
    setSheet(null);
    setEditEvId(null); setEditPostId(null);
    setBody(""); setPhoto(null); setEvAt(""); setEvEnd(""); setEvPlace(null); setEvPaste(""); setEvPlaceMsg(null);
    load();
  };

  const sendChat = async () => {
    if (!me || !chatBody.trim()) return;
    const t = chatBody.trim();
    setChatBody("");
    const { error } = await sendGroupMessage("tanbo", tanboId, me.id, t);
    if (error) {
      setChatBody(t);
      alert("送信できませんでした。通信環境を確認してもう一度どうぞ");
      return;
    }
    fetchGroupMessages("tanbo", tanboId).then((r) => setChat(r.slice(-30)));
  };

  const joinEvent = async (p: any) => {
    if (!me) { alert("ログインすると参加できます"); return; }
    await createClient().from("tanbo_event_rsvps").upsert({ post_id: p.id, user_id: me.id });
    if (p.event_at) {
      try {
        const d = new Date(p.event_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const memos = JSON.parse(readTecho());
        const day = memos[key] ?? { note: "", h: {} };
        day.ev = day.ev ?? [];
        const evId = `tanbo-${p.id}`;
        if (!day.ev.some((x: any) => x.id === evId)) {
          const de = p.event_end ? new Date(p.event_end) : null;
          const sameDay = de && de.toDateString() === d.toDateString();
          day.ev.push({
            id: evId, sh: d.getHours(), sm: d.getMinutes(),
            eh: sameDay ? de!.getHours() : Math.min(23, d.getHours() + 2),
            em: sameDay ? de!.getMinutes() : d.getMinutes(),
            text: `🌾${tanbo?.name ?? "田んぼ"}: ${String(p.body ?? "").split("\n")[0].slice(0, 30)}`,
            color: "green",
            place: (p.place_lat != null || p.place_name) ? { name: p.place_name ?? null, lat: p.place_lat ?? null, lng: p.place_lng ?? null, url: p.place_url ?? null } : undefined,
          });
          day.ev.sort((a: any, b: any) => a.sh * 60 + a.sm - (b.sh * 60 + b.sm));
          memos[key] = day;
          writeTecho(JSON.stringify(memos));
        }
      } catch {}
    }
    alert("参加します！手帳のこの日に予定が入りました📅");
  };

  if (!tanbo) return <main className="min-h-dvh" style={{ background: "#fff" }}><p className="pt-20 text-center text-[13px] text-[#a0aca0]">読み込み中...</p></main>;

  const cover = tanbo.cover_url ?? tanbo.photo_url;
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-20" style={{ background: "#f6faf4" }}>
      <IosBackButton />
      {/* カバー画像ブロック */}
      <div className="relative h-[150px]" style={{ background: cover ? `url(${srcCdn(cover)}) center/cover` : "linear-gradient(160deg,#7ab86a,#2a7a48)" }}>
        <div className="absolute left-3 top-3"><Link href="/sekai/kome" className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-bold text-white no-underline">◀ 米部</Link></div>
        <div className="absolute right-3 top-3"><AvatarMenu /></div>
        {joined && (
          <label className="absolute bottom-2 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-[15px] shadow-lg">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>

      {/* 文字情報は画像の下(アイコンは境目にめり込み) */}
      <header className="relative px-4 pb-4 text-center" style={{ background: "#f6faf4" }}>
        <div className="-mt-9 flex justify-center">
          <label className={joined ? "relative cursor-pointer" : "relative"}>
            <span className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-full border-4 border-[#f6faf4] bg-[#e4f0dc] text-[30px] shadow-lg">
              {tanbo.icon_url ? <img src={srcCdn(tanbo.icon_url)} alt="" className="h-full w-full object-cover" /> : "🌾"}
            </span>
            {joined && (
              <>
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] shadow">📷</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("icon", e.target.files?.[0] ?? null)} />
              </>
            )}
          </label>
        </div>
        <h1 className="mt-2 text-[20px] font-extrabold tracking-[1px] text-[#2a3a28]">{tanbo.name}</h1>
        <div className="mt-0.5 text-[11.5px] font-bold text-[#8aa088]">🌾 米部の田んぼ{tanbo.prefecture ? ` ・ 📍${tanbo.prefecture}` : ""}{tanbo.year ? ` ・ ${tanbo.year}年` : ""} ・ {members.size}人{isOwner ? "（あなたが田守）" : ""}</div>
        {tanbo.note && <p className="mx-auto mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-[#5a6a54]">{tanbo.note}</p>}
        {/* 参加者アイコンをずらっと(拠点ページと同じ) */}
        {memberProfs.length > 0 && (
          <div className="hide-scrollbar mt-2 flex items-center justify-center gap-1.5 overflow-x-auto px-2 pb-3">
            {memberProfs.map((pr: any, i: number) => {
              const inner = (
                <>
                  {pr?.avatar_url
                    ? <img src={srcCdn(pr.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border border-[#d8e8d0] object-cover" />
                    : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e4f0dc] text-[11px]">🌾</span>}
                  {pr.user_id === tanbo.user_id && (
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[8px] font-extrabold text-white shadow" style={{ background: "#c9a94a" }}>田守</span>
                  )}
                </>
              );
              return pr.username
                ? <Link key={i} href={`/u/${pr.username}`} className="relative flex-shrink-0">{inner}</Link>
                : <span key={i} className="relative flex-shrink-0">{inner}</span>;
            })}
            {members.size > memberProfs.length && <span className="num flex-shrink-0 text-[10px] font-bold text-[#8aa088]">+{Math.min(99, members.size - memberProfs.length)}</span>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={toggleJoin}
            className="rounded-xl px-6 py-2.5 text-[13px] font-extrabold"
            style={joined ? { border: `1px solid ${G}`, color: G, background: "transparent" } : { background: G, color: "#fff" }}
          >
            {joined ? "✓ 参加中（タップで抜ける）" : "この田んぼに参加する"}
          </button>
          {canManage && (
            <button onClick={() => { setEName(tanbo.name); setEPref(tanbo.prefecture ?? "東京都"); setENote(tanbo.note ?? ""); setEditing(true); }} className="rounded-xl border border-[#a8c8a0] px-3 py-2.5 text-[12px] font-bold" style={{ color: G }}>✎ 編集</button>
          )}
          {canManage && (
            <button onClick={async () => { if (!confirm("この田んぼのページを削除しますか？（投稿もすべて消えます）")) return; await deleteTanboPage(tanboId); router.push("/sekai/kome"); }} className="rounded-xl border border-[#c8a8a0] px-3 py-2.5 text-[12px] font-bold text-[#a05a4a]">🗑</button>
          )}
        </div>
      </header>

      <div className="px-3 pt-4">
        {/* ページ内タブ: FEED / MEMBERS / CHAT */}
        <div className="mb-3 flex gap-1.5">
          {([["feed", "FEED"], ["members", `MEMBERS ${members.size}`], ["chat", "CHAT"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} className="flex-1 rounded-full py-2 text-[12px] font-extrabold" style={tab === v ? { background: G, color: "#fff" } : { background: "#fff", color: "#8aa088", border: "1px solid #d8e8d0" }}>{l}</button>
          ))}
        </div>

        {/* ===== FEED ===== */}
        {tab === "feed" && (<>
        {events.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 px-1 text-[12px] font-extrabold" style={{ color: G }}>📅 近々のイベント（田植え・草取り・稲刈り）</div>
            <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-1">
              {events.map((p) => {
                const d = new Date(p.event_at);
                return (
                  <div key={p.id} className="w-[210px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: "#ffffff", border: "1px solid #d8e8d0" }}>
                    <div className="relative h-[92px] bg-[#e8f2e0]">
                      {p.photo_url ? <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[13px] font-bold" style={{ color: G }}>{tanbo.name}</div>}
                    </div>
                    <div className="p-2.5">
                      <div className="num text-[12.5px] font-extrabold text-[#2a3a28]">{d.getMonth() + 1}月{d.getDate()}日（{YOBI[d.getDay()]}）{d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}〜</div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] text-[#5a6a54]">{p.body}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {(p.place_name || p.place_lat != null) && (
                          <button onClick={() => setPlace({ name: p.place_name, lat: p.place_lat, lng: p.place_lng, url: p.place_url })} className="rounded-full border border-[#a8c8a0] px-2 py-0.5 text-[10px] font-bold" style={{ color: G }}>📍地図</button>
                        )}
                        {me && (me.id === p.user_id || tanbo.user_id === me.id || amAdmin) && (
                          <>
                            <button onClick={() => {
                              const d0 = new Date(p.event_at); const de = p.event_end ? new Date(p.event_end) : null; const pad = (n: number) => String(n).padStart(2, "0");
                              setSheet("event"); setEditEvId(p.id); setBody(p.body ?? ""); setPhoto(p.photo_url ?? null);
                              setEvAt(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}T${pad(d0.getHours())}:${pad(d0.getMinutes())}`);
                              setEvEnd(de ? `${de.getFullYear()}-${pad(de.getMonth() + 1)}-${pad(de.getDate())}T${pad(de.getHours())}:${pad(de.getMinutes())}` : "");
                              setEvPlace(p.place_name || p.place_lat != null ? { name: p.place_name ?? null, lat: p.place_lat ?? null, lng: p.place_lng ?? null, url: p.place_url ?? "", image: null } : null);
                            }} className="rounded-lg border border-[#a8c8a0] px-2.5 py-1 text-[13px] font-bold" style={{ color: G }}>✎ 編集</button>
                            <button onClick={async () => { if (!confirm("このイベントを削除しますか？")) return; await createClient().from("tanbo_posts").delete().eq("id", p.id); load(); }} className="rounded-lg border border-[#a8c8a0] px-2 py-1 text-[13px] font-bold" style={{ color: G }}>🗑</button>
                          </>
                        )}
                        <button onClick={() => joinEvent(p)} className="ml-auto rounded-full px-3 py-1 text-[11px] font-extrabold text-white" style={{ background: G }}>参加する</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {joined && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => setSheet("event")} className="rounded-xl py-2.5 text-[12.5px] font-extrabold text-white" style={{ background: G }}>📅 イベントを作る</button>
            <button onClick={() => setSheet("report")} className="rounded-xl border py-2.5 text-[12.5px] font-extrabold" style={{ borderColor: G, color: G }}>✏️ 田んぼの報告</button>
          </div>
        )}

        {posts.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#8aa088]">まだ報告がありません。田んぼの様子を投稿しましょう🌾</p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <div key={p.id} className="rounded-xl p-3" style={{ background: "#ffffff", border: "1px solid #d8e8d0" }}>
                <div className="flex items-center gap-2.5">
                  {p.profiles?.avatar_url ? <img src={srcCdn(p.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4f0dc] text-[13px]">🌾</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#2a3a28]">{p.profiles?.display_name ?? "メンバー"}</div>
                    <div className="num text-[10px] text-[#8aa088]">{new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}</div>
                  </div>
                  {me && (me.id === p.user_id || tanbo.user_id === me.id || amAdmin) && (
                    <span className="flex flex-shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => { setSheet("report"); setEditPostId(p.id); setBody(p.body ?? ""); setPhoto(p.photo_url ?? null); }}
                        className="rounded-lg border border-[#a8c8a0] px-2.5 py-1 text-[12px] font-bold" style={{ color: G }}
                      >✎ 編集</button>
                      <button
                        onClick={async () => { if (!confirm("削除しますか？")) return; await createClient().from("tanbo_posts").delete().eq("id", p.id); load(); }}
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef4ea] text-[13px] text-[#8aa088]"
                      >×</button>
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#3a4a34]">{p.body}</p>
                {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-2 max-h-96 w-full rounded-xl object-cover" />}
                {/* コメント */}
                <div className="mt-2 border-t border-[#e8f0e2] pt-2">
                  {(comments[p.id] ?? []).map((c: any) => (
                    <div key={c.id} className="mb-1.5 flex items-start gap-1.5">
                      {c.profiles?.avatar_url ? <img src={srcCdn(c.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" /> : <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#e4f0dc] text-[9px]">🌾</span>}
                      <div className="min-w-0 flex-1 rounded-lg bg-[#f2f8ee] px-2 py-1">
                        <span className="mr-1.5 text-[10px] font-bold" style={{ color: G }}>{c.profiles?.display_name ?? "メンバー"}</span>
                        <span className="break-words text-[12px] text-[#3a4a34]">{c.body}</span>
                      </div>
                    </div>
                  ))}
                  {me && (
                    <div className="flex items-end gap-1.5">
                      <input
                        value={cDraft[p.id] ?? ""}
                        onChange={(e) => setCDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        placeholder="コメントする..."
                        className="min-w-0 flex-1 rounded-full border border-[#d8e8d0] bg-white px-3 py-1.5 text-[12.5px] text-[#2a3a28] outline-none"
                      />
                      <button
                        onClick={async () => {
                          const b = (cDraft[p.id] ?? "").trim();
                          if (!b || !me) return;
                          await addTanboComment(p.id, me.id, b);
                          setCDraft((d) => ({ ...d, [p.id]: "" }));
                          fetchTanboComments(posts.map((x) => x.id)).then(setComments);
                        }}
                        disabled={!(cDraft[p.id] ?? "").trim()}
                        className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-40"
                        style={{ background: G }}
                      >送る</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </>)}

        {/* ===== MEMBERS ===== */}
        {tab === "members" && (
          <div className="space-y-1.5">
            {memberProfs.length === 0 ? <p className="py-6 text-center text-[12px] text-[#8aa088]">メンバーがいません</p> : memberProfs.map((pr: any, i: number) => {
              const row = (
                <div className="flex items-center gap-3 rounded-xl bg-white p-2.5" style={{ border: "1px solid #d8e8d0" }}>
                  {pr?.avatar_url ? <img src={srcCdn(pr.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f0dc] text-[15px]">🌾</span>}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-[#2a3a28]">{pr.display_name ?? "メンバー"}</span>
                  {pr.user_id === tanbo.user_id && <span className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: "#c9a94a" }}>田守（この田んぼの主）</span>}
                </div>
              );
              return pr.username ? <Link key={i} href={`/u/${pr.username}`} className="block no-underline">{row}</Link> : <div key={i}>{row}</div>;
            })}
            {members.size > memberProfs.length && <p className="py-2 text-center text-[11px] text-[#8aa088]">ほか{members.size - memberProfs.length}人</p>}
          </div>
        )}

        {/* ===== CHAT ===== */}
        {tab === "chat" && (
          joined ? (
            <div className="mb-3 rounded-2xl p-3" style={{ background: "#fff", border: "1px solid #d8e8d0" }}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12.5px] font-extrabold" style={{ color: G }}>💬 グループトーク</span>
                <a href={`/talk/g/tanbo/${tanboId}`} className="text-[11px] font-bold no-underline" style={{ color: G }}>TalKで開く →</a>
              </div>
              <div className="mb-2 max-h-64 space-y-1.5 overflow-y-auto rounded-xl bg-[#f2f8ee] p-2">
                {chat.length === 0 ? <p className="py-3 text-center text-[11px] text-[#8aa088]">まだ会話がありません。ひとこと目をどうぞ🌾</p> : chat.map((m: any) => {
                  const mine = m.sender_id === me?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[80%]">
                        {!mine && <div className="pl-1 text-[9px] text-[#8aa088]">{m.profiles?.display_name ?? "メンバー"}</div>}
                        <div className={`rounded-2xl px-3 py-1.5 text-[13px] ${mine ? "text-white" : "bg-white text-[#2a3a28]"}`} style={mine ? { background: G } : undefined}>{(m as any).image_url && <img src={srcCdn((m as any).image_url)} alt="" className="mb-1 max-w-[180px] rounded-lg" />}{m.body === "📷 写真" && (m as any).image_url ? "" : m.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-end gap-1.5">
                <textarea value={chatBody} onChange={(e) => setChatBody(e.target.value)} rows={1} placeholder="メッセージ..." className="hide-scrollbar max-h-24 min-h-[36px] flex-1 resize-none rounded-2xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] text-[#2a3a28] outline-none" />
                <button onClick={sendChat} disabled={!chatBody.trim()} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40" style={{ background: G }}>➤</button>
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-[12px] text-[#8aa088]">参加するとグループトークが使えます</p>
          )
        )}
      </div>

      {/* 投稿シート */}
      {sheet && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={() => { setSheet(null); setEditEvId(null); setEditPostId(null); }}>
          <div className="w-full max-w-[480px] rounded-t-2xl p-4" style={{ background: "#fff", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#d0e0c8]" />
            <div className="mb-2 text-[13.5px] font-extrabold text-[#2a3a28]">{sheet === "event" ? (editEvId ? "📅 イベントを編集" : "📅 イベントを作る") : (editPostId ? "✏️ 報告を編集" : "✏️ 田んぼの報告")}</div>
            {sheet === "event" && (
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#8aa088]">開始</span><input type="datetime-local" value={evAt} onChange={(e) => setEvAt(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] text-[#2a3a28] outline-none" /></div>
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#8aa088]">終了</span><input type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] text-[#2a3a28] outline-none" /><span className="text-[10px] text-[#8aa088]">任意</span></div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[#8aa088]">📍 場所 — Googleマップ/検索で調べて「共有→リンクをコピー」を貼るだけ</div>
                  {evPlace ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[#a8c8a0] bg-white px-3 py-2">
                      {evPlace.image && <img src={evPlace.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold" style={{ color: G }}>✓ {evPlace.name ?? "場所を取り込みました"}</span>
                      <button onClick={() => setEvPlace(null)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#eef4ea] text-[12px] text-[#8aa088]">×</button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input value={evPaste} onChange={(e) => { setEvPaste(e.target.value); if (/https?:\/\//.test(e.target.value)) resolveEvPlace(e.target.value); }} placeholder="https://maps.app.goo.gl/… または https://share.google/…" className="min-w-0 flex-1 rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[12.5px] text-[#2a3a28] outline-none" />
                      <button onClick={() => resolveEvPlace(evPaste)} disabled={!/https?:\/\//.test(evPaste) || evPlaceBusy} className="flex-shrink-0 rounded-xl px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-40" style={{ background: G }}>{evPlaceBusy ? "…" : "読取"}</button>
                    </div>
                  )}
                  {evPlaceMsg && <p className="mt-1 text-[11px] font-bold text-[#a05a4a]">{evPlaceMsg}</p>}
                </div>
              </div>
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus placeholder={sheet === "event" ? "イベントの内容（田植え・草取り・稲刈り・持ち物など）" : "今日の田んぼの様子（例: 苗がここまで育ちました）"} className="mb-2 w-full resize-y rounded-xl border border-[#d8e8d0] bg-white px-3 py-2.5 text-[13.5px] text-[#2a3a28] outline-none" />
            <label className="mb-2 flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[#d8e8d0] bg-white px-3 py-2 text-[12px] font-bold" style={{ color: G }}>
              {photo ? "✓ 写真あり" : "📷 写真"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55)); }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setSheet(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#8aa088]">キャンセル</button>
              <button onClick={publish} disabled={!body.trim() || saving || (sheet === "event" && !evAt)} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: G }}>{saving ? "保存中..." : (editEvId || editPostId) ? "変更を保存" : "投稿する"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 編集シート(名前・県・ひとこと) */}
      {editing && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50" onClick={() => setEditing(false)}>
          <div className="w-full max-w-[480px] rounded-t-2xl p-4" style={{ background: "#fff", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#d0e0c8]" />
            <div className="mb-2 text-[13.5px] font-extrabold text-[#2a3a28]">田んぼのページを編集</div>
            <input value={eName} onChange={(e) => setEName(e.target.value)} className="mb-2 w-full rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13.5px] text-[#2a3a28] outline-none" />
            <select value={ePref} onChange={(e) => setEPref(e.target.value)} className="mb-2 w-full rounded-xl border border-[#d8e8d0] bg-white px-2 py-2 text-[13px] text-[#2a3a28] outline-none">
              {PREFS.map((p) => <option key={p}>{p}</option>)}
            </select>
            <textarea value={eNote} onChange={(e) => setENote(e.target.value)} rows={2} placeholder="ひとこと（例: 5年放棄→今年田植え！）" className="mb-2 w-full resize-y rounded-xl border border-[#d8e8d0] bg-white px-3 py-2 text-[13px] text-[#2a3a28] outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#8aa088]">キャンセル</button>
              <button onClick={async () => { await updateTanboPage(tanboId, { name: eName.trim(), prefecture: ePref, note: eNote.trim() || null }); setEditing(false); load(); }} disabled={!eName.trim()} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: G }}>保存する</button>
            </div>
          </div>
        </div>
      )}
      {place && <PlaceOverlay place={place} onClose={() => setPlace(null)} />}
    </main>
  );
}
