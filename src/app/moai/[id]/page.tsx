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
import { fetchMoai, joinMoai, leaveMoai, fetchMoaiMemberIds, moaiCat, type Moai } from "@/lib/moai";

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
    setPosts(all.filter((p: any) => p.kind !== "event"));
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
      await joinMoai(moaiId, me.id);
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
    await supabase.from("moai_posts").insert({
      moai_id: moaiId,
      user_id: me.id,
      body: body.trim(),
      photo_url: photo,
      kind: isEvent ? "event" : "normal",
      event_at: isEvent && evAt ? new Date(evAt).toISOString() : null,
      event_end: isEvent && evEnd ? new Date(evEnd).toISOString() : null,
    });
    setSaving(false);
    setSheet(null);
    setBody(""); setPhoto(null); setEvAt(""); setEvEnd("");
    load();
  };

  const joinEvent = async (p: any) => {
    if (!me) { alert("ログインすると参加できます"); return; }
    await createClient().from("moai_event_rsvps").upsert({ post_id: p.id, user_id: me.id });
    alert("参加します！");
  };

  if (!moai) return <main className="min-h-dvh" style={{ background: "#1a1530" }}><p className="pt-20 text-center text-[13px] text-[#b8a8e0]">読み込み中...</p></main>;

  return (
    <main className="mx-auto min-h-dvh max-w-md pb-20" style={{ background: "linear-gradient(180deg,#1a1530,#241a3e)" }}>
      <IosBackButton />
      {/* ヘッダー: カバー + アイコン + 参加 */}
      <header
        className="relative px-4 pb-4 pt-3 text-center"
        style={{
          background: moai.cover_url
            ? `linear-gradient(165deg, rgba(20,12,40,.35), rgba(30,18,55,.55)), url(${moai.cover_url}) center/cover`
            : "linear-gradient(165deg,#241a3e,#1a1530)",
        }}
      >
        <div className="flex items-center justify-between">
          <Link href="/moai" className="text-[13px] font-bold text-[#c8b8f0] no-underline">◀ MOAI</Link>
          <span className="absolute right-3 top-3"><AvatarMenu /></span>
        </div>
        <div className="mt-2 flex justify-center">
          <label className={isLeader ? "relative cursor-pointer" : "relative"}>
            <span className="flex h-[74px] w-[74px] items-center justify-center overflow-hidden rounded-full border-4 border-[#241a3e] bg-[#3a2a5e] text-[30px] shadow-lg">
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
        <h1 className="mt-2 text-[20px] font-extrabold tracking-[1px] text-[#eee6ff]">{moai.name}</h1>
        <div className="mt-0.5 text-[11.5px] text-[#b8a8e0]">{moaiCat(moai.category).emoji} {moaiCat(moai.category).label} ・ {members.size}人</div>
        {moai.description && <p className="mx-auto mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-[#c8bce8]">{moai.description}</p>}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={toggleJoin}
            className="rounded-xl px-6 py-2.5 text-[13px] font-extrabold"
            style={joined ? { border: "1px solid #9a7ae0", color: "#c8b8f0", background: "transparent" } : { background: "#7a5ac0", color: "#fff" }}
          >
            {joined ? "✓ 参加中（タップで退会）" : "このMOAIに参加する"}
          </button>
        </div>
        {isLeader && (
          <label className="absolute right-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white text-[15px] shadow-lg" style={{ bottom: -18 }}>
            📷
            <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)} />
          </label>
        )}
      </header>

      <div className="px-3 pt-6">
        {/* 近々のイベント（横スクロール・トップ） */}
        {events.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 px-1 text-[12px] font-extrabold text-[#c8b8f0]">📅 近々のイベント</div>
            <div className="hide-scrollbar flex gap-2.5 overflow-x-auto pb-1">
              {events.map((p) => {
                const d = new Date(p.event_at);
                return (
                  <div key={p.id} className="w-[210px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ background: "rgba(255,255,255,.06)", border: "1px solid #4a3a6a" }}>
                    <div className="relative h-[92px] bg-[#2a2048]">
                      {p.photo_url ? <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[13px] font-bold text-[#c8b8f0]">{moai.name}</div>}
                    </div>
                    <div className="p-2.5">
                      <div className="num text-[12.5px] font-extrabold text-[#eee6ff]">{d.getMonth() + 1}月{d.getDate()}日（{YOBI[d.getDay()]}）{d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}〜</div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] text-[#c8bce8]">{p.body}</div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {(p.place_name || p.place_lat != null) && (
                          <button onClick={() => setPlace({ name: p.place_name, lat: p.place_lat, lng: p.place_lng, url: p.place_url })} className="rounded-full border border-[#6a5a9a] px-2 py-0.5 text-[10px] font-bold text-[#c8b8f0]">📍地図</button>
                        )}
                        <button onClick={() => joinEvent(p)} className="ml-auto rounded-full px-3 py-1 text-[11px] font-extrabold text-white" style={{ background: "#7a5ac0" }}>参加する</button>
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
            <button onClick={() => setSheet("event")} className="rounded-xl py-2.5 text-[12.5px] font-extrabold text-white" style={{ background: "#7a5ac0" }}>📅 イベントを作る</button>
            <button onClick={() => setSheet("report")} className="rounded-xl border py-2.5 text-[12.5px] font-extrabold" style={{ borderColor: "#7a5ac0", color: "#c8b8f0" }}>✏️ 活動を投稿</button>
          </div>
        )}

        {/* 活動FEED */}
        {posts.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-[#9a8ac0]">まだ投稿がありません。最初の活動を投稿しましょう</p>
        ) : (
          <div className="space-y-2.5">
            {posts.map((p) => (
              <div key={p.id} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid #4a3a6a" }}>
                <div className="flex items-center gap-2.5">
                  {p.profiles?.avatar_url ? <img src={srcCdn(p.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" /> : <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3a2a5e] text-[13px]">🗿</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#eee6ff]">{p.profiles?.display_name ?? "メンバー"}</div>
                    <div className="num text-[10px] text-[#a898d0]">{new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}</div>
                  </div>
                  {me && (me.id === p.user_id || moai.created_by === me.id) && (
                    <button
                      onClick={async () => { if (!confirm("削除しますか？")) return; await createClient().from("moai_posts").delete().eq("id", p.id); load(); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[12px] text-[#b8a8e0]"
                    >×</button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#e0d8f4]">{p.body}</p>
                {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-2 max-h-96 w-full rounded-xl object-cover" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 投稿シート */}
      {sheet && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50" onClick={() => setSheet(null)}>
          <div className="w-full max-w-[480px] rounded-t-2xl p-4" style={{ background: "#241a3e", paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#5a4a7a]" />
            <div className="mb-2 text-[13.5px] font-extrabold text-[#eee6ff]">{sheet === "event" ? "📅 イベントを作る" : "✏️ 活動を投稿"}</div>
            {sheet === "event" && (
              <div className="mb-2 space-y-1.5">
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#b8a8e0]">開始</span><input type="datetime-local" value={evAt} onChange={(e) => setEvAt(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-3 py-2 text-[13px] text-white outline-none" /></div>
                <div className="flex items-center gap-2"><span className="w-8 text-[11px] font-bold text-[#b8a8e0]">終了</span><input type="datetime-local" value={evEnd} onChange={(e) => setEvEnd(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-3 py-2 text-[13px] text-white outline-none" /><span className="text-[10px] text-[#9a8ac0]">任意</span></div>
              </div>
            )}
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} autoFocus placeholder={sheet === "event" ? "イベントの内容（持ち物・場所など）" : "今日の活動を書こう"} className="mb-2 w-full resize-y rounded-xl border border-[#4a3a6a] bg-[#1a1530] px-3 py-2.5 text-[13.5px] text-white outline-none focus:border-[#9a7ae0]" />
            <label className="mb-2 flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-[#4a3a6a] bg-[#1a1530] px-3 py-2 text-[12px] font-bold text-[#c8b8f0]">
              {photo ? "✓ 写真あり" : "📷 写真"}
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55)); }} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setSheet(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#b8a8e0]">キャンセル</button>
              <button onClick={publish} disabled={!body.trim() || saving || (sheet === "event" && !evAt)} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#7a5ac0" }}>{saving ? "投稿中..." : "投稿する"}</button>
            </div>
          </div>
        </div>
      )}
      {place && <PlaceOverlay place={place} onClose={() => setPlace(null)} />}
    </main>
  );
}
