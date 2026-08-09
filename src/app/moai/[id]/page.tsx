"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { AvatarMenu } from "@/components/AvatarMenu";
import { IosBackButton } from "@/components/IosBackButton";
import { PlaceOverlay, type PlaceInfo } from "@/components/PlaceOverlay";
import { fetchMoai, joinMoai, leaveMoai, fetchMoaiMemberIds, fetchMoaiMembers, updateMoai, deleteMoai, fetchMoaiComments, addMoaiComment, fetchMoaiPending, approveMoaiMember, rejectMoaiMember, myMoaiStatus, moaiCat, MOAI_CATEGORIES, type Moai } from "@/lib/moai";
import { readTecho, writeTecho } from "@/lib/techoStore";
import { PREFS } from "@/lib/sekai";
import { useRouter } from "next/navigation";

const YOBI = ["日", "月", "火", "水", "木", "金", "土"];

export default function MoaiDetailPage() {
  const params = useParams<{ id: string }>();
  const moaiId = params.id;
  const [me, setMe] = useState<User | null>(null);
  const [moai, setMoai] = useState<Moai | null>(null);
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const joined = !!me && members.has(me.id);
  const isLeader = !!me && (moai?.created_by === me.id || joined);

  // 投稿シート
  const [sheet, setSheet] = useState<null | "report" | "event">(null);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [evAt, setEvAt] = useState("");
  const [evEnd, setEvEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [editEvId, setEditEvId] = useState<string | null>(null);
  const [evPlace, setEvPlace] = useState<{ name: string | null; lat: number | null; lng: number | null; url: string; image: string | null } | null>(null);
  const [evPaste, setEvPaste] = useState("");
  const [evPlaceBusy, setEvPlaceBusy] = useState(false);
  const [evPlaceMsg, setEvPlaceMsg] = useState<string | null>(null);
  const router = useRouter();
  const resolveEvPlace = async (raw: string) => {
    const mm = raw.match(/https?:\/\/[^\s]+/);
    if (!mm || evPlaceBusy) return;
    const url = mm[0];
    const hint = raw.replace(url, "").replace(/[\n\r\"']+/g, " ").trim().slice(0, 100);
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
  const [memberProfs, setMemberProfs] = useState<any[]>([]);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [cDraft, setCDraft] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState("");
  const [eCat, setECat] = useState("music");
  const [eDesc, setEDesc] = useState("");
  const [eKw, setEKw] = useState("");
  const [ePref, setEPref] = useState("東京都");
  const [eCity, setECity] = useState("");
  const [ePolicy, setEPolicy] = useState<"open"|"approval">("open");
  const [eCities, setECities] = useState<string[]>([]);
  useEffect(() => {
    if (!editing) return;
    fetch("/data-municipalities.json").then((r) => r.json()).then((muni) => setECities((muni[ePref] ?? []).map((x: any) => x[0]))).catch(() => setECities([]));
  }, [ePref, editing]);
  const isOwner = !!me && moai?.created_by === me.id;
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [amAdmin, setAmAdmin] = useState(false);
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmAdmin)).catch(() => {});
  }, [me]);
  const canManage = isOwner || amAdmin;

  const load = useCallback(async () => {
    const [m, mem] = await Promise.all([fetchMoai(moaiId), fetchMoaiMemberIds(moaiId)]);
    setMoai(m);
    setMembers(mem);
    const supabase = createClient();
    const { data: ps } = await supabase
      .from("moai_posts")
      .select("id, body, photo_url, kind, event_at, event_end, place_name, place_lat, place_lng, place_url, created_at, user_id, profiles!moai_posts_user_id_fkey(username, display_name, avatar_url)")
      .eq("moai_id", moaiId)
      .order("created_at", { ascending: false })
      .limit(50);
    const all = ps ?? [];
    const normals = all.filter((p: any) => p.kind !== "event");
    setPosts(normals);
    fetchMoaiMembers(moaiId).then(setMemberProfs);
    { const supa = createClient(); supa.auth.getSession().then(({ data: { session } }) => { const uid = session?.user?.id; if (uid) myMoaiStatus(moaiId, uid).then(setMyStatus); }); }
    if (m && m.created_by) fetchMoaiPending(moaiId).then(setPending);
    fetchMoaiComments(all.map((x: any) => x.id)).then(setComments);
    setEvents(all.filter((p: any) => p.kind === "event" && p.event_at && new Date(p.event_at) >= new Date(Date.now() - 3 * 3600e3)).sort((a: any, b: any) => new Date(a.event_at).getTime() - new Date(b.event_at).getTime()));
  }, [moaiId]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
    load();
  }, [load]);

  const toggleJoin = async () => {
    if (!me) { alert("ログインすると参加できます（無料のGoogleログイン）"); return; }
    if (joined) {
      if (!confirm("このMOAIから抜けますか？")) return;
      await leaveMoai(moaiId, me.id);
    } else {
      await joinMoai(moaiId, me.id, moai?.join_policy);
      if (moai?.join_policy === "approval") alert("入部を申請しました。OYAの承認をお待ちください🙏");
    }
    load();
  };

  const changeImage = async (which: "icon" | "cover", f: File | null) => {
    if (!f || !me) return;
    const url = await uploadImage("post-images", me.id, f, which === "cover" ? 1600 : 512, which === "cover" ? 0.75 : 0.8);
    if (url) {
      await createClient().from("moai").update({ [which === "cover" ? "cover_url" : "icon_url"]: url }).eq("id", moaiId);
      load();
    }
  };

  const publish = async () => {
    if (!me || !body.trim() || saving) return;
    setSaving(true);
    const supabase = createClient();
    const isEvent = sheet === "event";
    // 貼ったリンクが未取り込みなら保存前に取り込む
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
    if (editEvId) await supabase.from("moai_posts").update(payload).eq("id", editEvId);
    else await supabase.from("moai_posts").insert({ moai_id: moaiId, user_id: me.id, ...payload });
    setSaving(false);
    setSheet(null);
    setEditEvId(null);
    setBody(""); setPhoto(null); setEvAt(""); setEvEnd(""); setEvPlace(null); setEvPaste(""); setEvPlaceMsg(null);
    load();
  };

  const joinEvent = async (p: any) => {
    if (!me) { alert("ログインすると参加できます"); return; }
    await createClient().from("moai_event_rsvps").upsert({ post_id: p.id, user_id: me.id });
    // 手帳のその日時に、場所つきの予定として自動登録(タップで地図が開く)
    if (p.event_at) {
      try {
        const d = new Date(p.event_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const memos = JSON.parse(readTecho());
        const day = memos[key] ?? { note: "", h: {} };
        day.ev = day.ev ?? [];
        const evId = `moai-${p.id}`;
        if (!day.ev.some((x: any) => x.id === evId)) {
          const de = p.event_end ? new Date(p.event_end) : null;
          const sameDay = de && de.toDateString() === d.toDateString();
          day.ev.push({
            id: evId, sh: d.getHours(), sm: d.getMinutes(),
            eh: sameDay ? de!.getHours() : Math.min(23, d.getHours() + 2),
            em: sameDay ? de!.getMinutes() : d.getMinutes(),
            text: `🗿${moai?.name ?? "MOAI"}: ${String(p.body ?? "").split("\n")[0].slice(0, 30)}`,
            color: "purple",
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

  if (!moai) return <main className="min-h-dvh" style={{ background: "#fff" }}><p className="pt-20 text-center text-[13px] text-[#a08078]">読み込み中...</p></main>;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-20" style={{ background: "#fbf7f5" }}>
      <IosBackButton />
      {/* カバー画像ブロック（写真だけ・文字は乗せない） */}
      <div className="relative h-[150px]" style={{ background: moai.cover_url ? `url(${moai.cover_url}) center/cover` : "linear-gradient(160deg,#e8564a,#c0392b)" }}>
        <div className="absolute left-3 top-3"><Link href="/moai" className="rounded-full bg-black/35 px-2.5 py-1 text-[12px] font-bold text-white no-underline">◀ MOAI</Link></div>
        <div className="absolute right-3 top-3"><AvatarMenu /></div>
        {isLeader && (
          <label className="absolute bottom-2 right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-[15px] shadow-lg">
            📷
            <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>

      {/* 文字情報は画像の下・明るい背景で（アイコンは境目にめり込み） */}
      <header className="relative px-4 pb-4 text-center" style={{ background: "#fbf7f5" }}>
        <div className="-mt-9 flex justify-center">
          <label className={isLeader ? "relative cursor-pointer" : "relative"}>
            <span className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-full border-4 border-[#fbf7f5] bg-[#f3ded9] text-[30px] shadow-lg">
              {moai.icon_url ? <img src={srcCdn(moai.icon_url)} alt="" className="h-full w-full object-cover" /> : moaiCat(moai.category).emoji}
            </span>
            {isLeader && (
              <>
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] shadow">📷</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("icon", e.target.files?.[0] ?? null)} />
              </>
            )}
          </label>
        </div>
        <h1 className="mt-2 text-[20px] font-extrabold tracking-[1px] text-[#3a2420]">{moai.name}</h1>
        <div className="mt-0.5 text-[11.5px] font-bold text-[#a08078]">{moaiCat(moai.category).emoji} {moaiCat(moai.category).label}{moai.prefecture ? ` ・ 📍${moai.prefecture}${moai.city ?? ""}` : ""} ・ {members.size}人{isOwner ? "（あなたがOYA）" : ""}</div>
        {moai.description && <p className="mx-auto mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-[#6a5048]">{moai.description}</p>}
        {/* 部員アイコンをずらっと */}
        {memberProfs.length > 0 && (
          <div className="hide-scrollbar mt-2 flex items-center justify-center gap-1.5 overflow-x-auto px-2 pb-3">
            {memberProfs.map((pr: any, i: number) => (
              <span key={i} className="relative flex-shrink-0">
                {pr?.avatar_url
                  ? <img src={srcCdn(pr.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full border border-[#f0d8d4] object-cover" />
                  : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3ded9] text-[11px]">🗿</span>}
                {pr.user_id === moai.created_by && (
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[8px] font-extrabold text-white shadow" style={{ background: "#c9a94a" }}>OYA</span>
                )}
              </span>
            ))}
            {members.size > memberProfs.length && <span className="num flex-shrink-0 text-[10px] text-[#b09088]">+{members.size - memberProfs.length}</span>}
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={toggleJoin}
            className="rounded-xl px-6 py-2.5 text-[13px] font-extrabold"
            style={joined ? { border: "1px solid #c0392b", color: "#c0392b", background: "transparent" } : { background: "#c0392b", color: "#fff" }}
          >
            {joined ? "✓ 参加中（タップで退会）" : myStatus === "pending" ? "申請中（承認待ち・タップで取消）" : moai.join_policy === "approval" ? "入部を申請する（承認制）" : "入部希望（このMOAIに参加）"}
          </button>
          {canManage && (
            <button onClick={() => { setEName(moai.name); setECat(moai.category ?? "music"); setEDesc(moai.description ?? ""); setEKw((moai as any).keywords ?? ""); setEPolicy(((moai as any).join_policy === "approval") ? "approval" : "open"); setEPref(moai.prefecture ?? "東京都"); setECity(moai.city ?? ""); setEditing(true); }} className="rounded-xl border border-[#e0a89f] px-3 py-2.5 text-[12px] font-bold text-[#c0392b]">✎ 編集</button>
          )}
          {canManage && (
            <button onClick={async () => { if (!confirm("このMOAIを削除しますか？（投稿もすべて消えます）")) return; await deleteMoai(moaiId); router.push("/moai"); }} className="rounded-xl border border-[#a05a6a] px-3 py-2.5 text-[12px] font-bold text-[#c0392b]">🗑</button>
          )}
        </div>
      </header>

      <div className="px-3 pt-6">
        {/* 承認待ちの入部申請(OYA・管理者のみ) */}
        {canManage && pending.length > 0 && (
          <div className="mb-3 rounded-xl p-3" style={{ background: "#fff", border: "1px solid #e8c4b8" }}>
            <div className="mb-1.5 text-[12px] font-extrabold text-[#c0392b]">入部申請 {pending.length}件</div>
            {pending.map((pr: any) => (
              <div key={pr.user_id} className="flex items-center gap-2 border-b border-[#f0ece8] py-1.5 last:border-b-0">
                {pr.avatar_url ? <img src={srcCdn(pr.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f3ded9] text-[11px]">🗿</span>}
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[#3a2420]">{pr.display_name ?? "むらびと"}</span>
                <button onClick={async () => { await approveMoaiMember(moaiId, pr.user_id); load(); }} className="rounded-lg px-3 py-1 text-[11px] font-extrabold text-white" style={{ background: "#2a8a4a" }}>承認</button>
                <button onClick={async () => { await rejectMoaiMember(moaiId, pr.user_id); load(); }} className="rounded-lg border px-2.5 py-1 text-[11px] font-bold text-[#c0392b]" style={{ borderColor: "#e0a89f" }}>却下</button>
              </div>
            ))}
          </div>
        )}
        {/* 近々のイベント（横スクロール・トップ） */}
        {events.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 px-1 text-[12px] font-extrabold text-[#c0392b]">📅 近々のイベント</div>
            <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-1">
              {events.map((p) => {
                const d = new Date(p.event_at);
                return (
                  <div key={p.id} className="w-[210px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: "#ffffff", border: "1px solid #f0d8d4" }}>
                    <div className="relative h-[92px] bg-[#f6e4e0]">
                      {p.photo_url ? <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-[#c0392b]">{moai.name}</div>}
                    </div>
                    <div className="p-2.5">
                      <div className="num text-[12.5px] font-extrabold text-[#3a2420]">{d.getMonth() + 1}月{d.getDate()}日（{YOBI[d.getDay()]}）{d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}〜</div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] text-[#6a5048]">{p.body}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {(p.place_name || p.place_lat != null) && (
                          <button onClick={() => setPlace({ name: p.place_name, lat: p.place_lat, lng: p.place_lng, url: p.place_url })} className="rounded-full border border-[#e0a89f] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">📍地図</button>
                        )}
                        {me && (me.id === p.user_id || moai.created_by === me.id || amAdmin) && (
                          <>
                            <button onClick={() => {
                              const d0 = new Date(p.event_at); const de = p.event_end ? new Date(p.event_end) : null; const pad = (n: number) => String(n).padStart(2, "0");
                              setSheet("event"); setEditEvId(p.id); setBody(p.body ?? ""); setPhoto(p.photo_url ?? null);
                              setEvAt(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}T${pad(d0.getHours())}:${pad(d0.getMinutes())}`);
                              setEvEnd(de ? `${de.getFullYear()}-${pad(de.getMonth() + 1)}-${pad(de.getDate())}T${pad(de.getHours())}:${pad(de.getMinutes())}` : "");
                              setEvPlace(p.place_name || p.place_lat != null ? { name: p.place_name ?? null, lat: p.place_lat ?? null, lng: p.place_lng ?? null, url: p.place_url ?? "", image: null } : null);
                            }} className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[#c0392b]" style={{ borderColor: "#e0a89f" }}>✎</button>
                            <button onClick={async () => { if (!confirm("このイベントを削除しますか？")) return; await createClient().from("moai_posts").delete().eq("id", p.id); load(); }} className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-[#c0392b]" style={{ borderColor: "#e0a89f" }}>🗑</button>
                          </>
                        )}
                        <button onClick={() => joinEvent(p)} className="ml-auto rounded-full px-3 py-1 text-[11px] font-extrabold text-white" style={{ background: "#c0392b" }}>参加する</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 投稿ボタン（メンバーのみ） */}
        {joined && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => setSheet("event")} className="rounded-xl py-2.5 text-[12.5px] font-extrabold text-white" style={{ background: "#c0392b" }}>📅 イベントを作る</button>
            <button onClick={() => setSheet("report")} className="rounded-xl border py-2.5 text-[12.5px] font-extrabold" style={{ borderColor: "#c0392b", color: "#c0392b" }}>✏️ 活動を投稿</button>
          </div>
        )}

        {/* 活動FEED */}
        {posts.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#b09088]">まだ投稿がありません。最初の活動を投稿しましょう</p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <div key={p.id} className="rounded-xl p-3" style={{ background: "#ffffff", border: "1px solid #f0d8d4" }}>
                <div className="flex items-center gap-2.5">
                  {p.profiles?.avatar_url ? <img src={srcCdn(p.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3ded9] text-[13px]">🗿</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#3a2420]">{p.profiles?.display_name ?? "メンバー"}</div>
                    <div className="num text-[10px] text-[#b09088]">{new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}</div>
                  </div>
                  {me && (me.id === p.user_id || moai.created_by === me.id) && (
                    <button
                      onClick={async () => { if (!confirm("削除しますか？")) return; await createClient().from("moai_posts").delete().eq("id", p.id); load(); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0ece8] text-[12px] text-[#a08078]"
                    >×</button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#4a3630]">{p.body}</p>
                {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-2 max-h-96 w-full rounded-xl object-cover" />}
                {/* コメント */}
                <div className="mt-2 border-t border-[#f0d8d4] pt-2">
                  {(comments[p.id] ?? []).map((c: any) => (
                    <div key={c.id} className="mb-1.5 flex items-start gap-1.5">
                      {c.profiles?.avatar_url ? <img src={srcCdn(c.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" /> : <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#f3ded9] text-[9px]">🗿</span>}
                      <div className="min-w-0 flex-1 rounded-lg bg-[#fff] px-2 py-1">
                        <span className="mr-1.5 text-[10px] font-bold text-[#c0392b]">{c.profiles?.display_name ?? "メンバー"}</span>
                        <span className="break-words text-[12px] text-[#4a3630]">{c.body}</span>
                      </div>
                    </div>
                  ))}
                  {me && (
                    <div className="flex items-end gap-1.5">
                      <input
                        value={cDraft[p.id] ?? ""}
                        onChange={(e) => setCDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        placeholder="コメントする..."
                        className="min-w-0 flex-1 rounded-full border border-[#f0d8d4] bg-[#fff] px-3 py-1.5 text-[12.5px] text-[#3a2420] outline-none focus:border-[#c0392b]"
                      />
                      <button
                        onClick={async () => {
                          const b = (cDraft[p.id] ?? "").trim();
                          if (!b || !me) return;
                          await addMoaiComment(p.id, me.id, b);
                          setCDraft((d) => ({ ...d, [p.id]: "" }));
                          fetchMoaiComments(posts.map((x) => x.id)).then(setComments);
                        }}
                        disabled={!(cDraft[p.id] ?? "").trim()}
                        className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-40"
                        style={{ background: "#c0392b" }}
                      >送る</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 投稿シート */}
      {sheet && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={() => { setSheet(null); setEditEvId(null); }}>
          <div className="w-full max-w-[480px] rounded-t-2xl p-4" style={{ background: "#fff", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#e0d0cc]" />
            <div className="mb-2 text-[13.5px] font-extrabold text-[#3a2420]">{sheet === "event" ? (editEvId ? "📅 イベントを編集" : "📅 イベントを作る") : "✏️ 活動を投稿"}</div>
            {sheet === "event" && (
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#a08078]">開始</span><input type="datetime-local" value={evAt} onChange={(e) => setEvAt(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none" /></div>
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#a08078]">終了</span><input type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none" /><span className="text-[10px] text-[#b09088]">任意</span></div>
                <div>
                  <div className="mb-1 text-[10.5px] font-bold text-[#a08078]">📍 場所 — Googleマップ/検索で調べて「共有→リンクをコピー」を貼るだけ</div>
                  {evPlace ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[#e0a89f] bg-[#fff] px-3 py-2">
                      {evPlace.image && <img src={evPlace.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-[#c0392b]">✓ {evPlace.name ?? "場所を取り込みました"}</span>
                      <button onClick={() => setEvPlace(null)} className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece8] text-[12px] text-[#a08078]">×</button>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <input value={evPaste} onChange={(e) => { setEvPaste(e.target.value); if (/https?:\/\//.test(e.target.value)) resolveEvPlace(e.target.value); }} placeholder="https://maps.app.goo.gl/… または https://share.google/…" className="min-w-0 flex-1 rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[12.5px] text-[#3a2420] outline-none focus:border-[#c0392b]" />
                      <button onClick={() => resolveEvPlace(evPaste)} disabled={!/https?:\/\//.test(evPaste) || evPlaceBusy} className="flex-shrink-0 rounded-xl px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c0392b" }}>{evPlaceBusy ? "…" : "読取"}</button>
                    </div>
                  )}
                  {evPlaceMsg && <p className="mt-1 text-[11px] font-bold text-[#c0392b]">{evPlaceMsg}</p>}
                </div>
              </div>
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus placeholder={sheet === "event" ? "イベントの内容（持ち物・場所など）" : "今日の活動を書こう"} className="mb-2 w-full resize-y rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2.5 text-[13.5px] text-[#3a2420] outline-none focus:border-[#c0392b]" />
            <label className="mb-2 flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[12px] font-bold text-[#c0392b]">
              {photo ? "✓ 写真あり" : "📷 写真"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55)); }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setSheet(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a08078]">キャンセル</button>
              <button onClick={publish} disabled={!body.trim() || saving || (sheet === "event" && !evAt)} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c0392b" }}>{saving ? "保存中..." : editEvId ? "変更を保存" : "投稿する"}</button>
            </div>
          </div>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/50" onClick={() => setEditing(false)}>
          <div className="w-full max-w-[480px] rounded-t-2xl p-4" style={{ background: "#fff", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#e0d0cc]" />
            <div className="mb-2 text-[13.5px] font-extrabold text-[#3a2420]">MOAIを編集</div>
            <input value={eName} onChange={(e) => setEName(e.target.value)} className="mb-2 w-full rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13.5px] text-[#3a2420] outline-none" />
            <select value={eCat} onChange={(e) => setECat(e.target.value)} className="mb-2 w-full rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
              {MOAI_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
            <div className="mb-2 flex gap-2">
              {([["open","誰でも参加OK"],["approval","承認制"]] as const).map(([v,l]) => (
                <button key={v} type="button" onClick={() => setEPolicy(v)} className="flex-1 rounded-xl border-2 py-2 text-[12px] font-extrabold" style={ePolicy===v ? {borderColor:"#c0392b",background:"#c0392b",color:"#fff"} : {borderColor:"#f0d8d4",color:"#a08078",background:"#fff"}}>{l}</button>
              ))}
            </div>
            <div className="mb-2 flex gap-2">
              <select value={ePref} onChange={(e) => { setEPref(e.target.value); setECity(""); }} className="rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
                <option>オンライン</option>{PREFS.map((p) => <option key={p}>{p}</option>)}<option>海外</option>
              </select>
              <select value={eCity} onChange={(e) => setECity(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#f0d8d4] bg-[#fff] px-2 py-2 text-[13px] text-[#3a2420] outline-none">
                <option value="">市町村を選ぶ</option>
                {eCities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <textarea value={eDesc} onChange={(e) => setEDesc(e.target.value)} rows={2} className="mb-2 w-full resize-y rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none" />
            <textarea value={eKw} onChange={(e) => setEKw(e.target.value)} rows={2} placeholder="検索キーワード（沢山ほど見つかりやすい）" className="mb-2 w-full resize-y rounded-xl border border-[#f0d8d4] bg-[#fff] px-3 py-2 text-[13px] text-[#3a2420] outline-none" />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a08078]">キャンセル</button>
              <button onClick={async () => { await updateMoai(moaiId, { name: eName.trim(), category: eCat, description: eDesc.trim() || null, keywords: eKw.trim() || null, join_policy: ePolicy, prefecture: ePref, city: eCity || null }); setEditing(false); load(); }} disabled={!eName.trim()} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c0392b" }}>保存する</button>
            </div>
          </div>
        </div>
      )}
      {place && <PlaceOverlay place={place} onClose={() => setPlace(null)} />}
    </main>
  );
}
