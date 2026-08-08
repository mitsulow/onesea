"use client";

import { SekaiMenuButton } from "@/components/sekai/sections";
import { PhotoCropper } from "@/components/PhotoCropper";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { uploadImage } from "@/lib/images";
import { joinClub, leaveClub } from "@/lib/sekai";
import { CameraIcon } from "@/components/CameraIcon";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

const GREEN = "#3a7a4c";

/** 部室 — 部活の詳細（部員・活動記録） */
export default function ClubPage() {
  const params = useParams<{ id: string }>();
  const clubId = params.id;
  const [me, setMe] = useState<User | null>(null);
  const [club, setClub] = useState<any | null | undefined>(undefined);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<{ kind: "cover" | "icon"; file: File } | null>(null); // 切り抜き中の画像
  const [lookBusy, setLookBusy] = useState<"cover" | "icon" | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: c }, { data: m }, { data: p }, { data: session }] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).maybeSingle(),
      supabase
        .from("club_members")
        .select("user_id, profiles!club_members_user_id_fkey(username, display_name, avatar_url)")
        .eq("club_id", clubId)
        .limit(60),
      supabase
        .from("club_posts")
        .select("id, body, photo_url, created_at, user_id, profiles!club_posts_user_id_fkey(username, display_name, avatar_url)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.auth.getSession().then((r) => ({ data: r.data.session })),
    ]);
    setClub(c ?? null);
    setMembers(m ?? []);
    setPosts(p ?? []);
    const u = session?.user ?? null;
    setMe(u);
    if (u) setJoined((m ?? []).some((x: any) => x.user_id === u.id));
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const supabase = createClient();
    await supabase.from("club_posts").insert({ club_id: clubId, user_id: me.id, body: body.trim(), photo_url: photo });
    setBody("");
    setPhoto(null);
    setSending(false);
    load();
  };

  if (club === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4a8a5c] border-t-transparent" />
      </div>
    );
  }
  if (club === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-[#8a8070]">この部活は見つかりませんでした</p>
        <Link href="/sekai" className="mt-4 inline-block text-sm underline" style={{ color: GREEN }}>
          セカイムラへもどる
        </Link>
      </div>
    );
  }

  return (
    <main className="pb-20">
      <SekaiMenuButton floating />
      <header
        className="relative px-4 pb-5 pt-4 text-center"
        style={
          club.cover_url
            ? { backgroundImage: `linear-gradient(rgba(10,22,14,.62), rgba(10,22,14,.72)), url(${club.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)" }
        }
      >
        <div className="flex items-center justify-between">
          <Link href="/sekai" className="text-[13px] font-bold text-[#a8cca8] no-underline">
            ◀ セカイムラ
          </Link>
          {club.is_official && (
            <span className="rounded-full bg-[#d4b96a]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#eae6b8]">
              公式部活
            </span>
          )}
        </div>
        <div className="mt-3 leading-none">
          <span className="relative inline-block">
            {club.icon_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.icon_url} alt="" className="mx-auto h-[64px] w-[64px] rounded-full border-2 border-white/40 object-cover" />
            ) : (
              <span className="text-[44px]">{club.emoji ?? "🎌"}</span>
            )}
            {me && joined && (
              <label className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#d4b96a] text-[#1a2432] shadow">
                {lookBusy === "icon" ? "⏳" : <CameraIcon size={14} />}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setCropSrc({ kind: "icon", file: f });
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </span>
        </div>
        <h1 className="mt-2 text-[21px] font-extrabold tracking-[2px] text-[#eaf2e6]">{club.name}</h1>
        <div className="mt-1 text-[11.5px] text-[#a8cca8]">
          {club.scope} ・ 部員 {members.length}人
        </div>
        {club.description && (
          <p className="mx-auto mt-2 max-w-[340px] text-[12px] leading-relaxed text-[#c8dcc8]">{club.description}</p>
        )}
        {me && (
          <button
            onClick={async () => {
              if (joined) await leaveClub(me.id, clubId);
              else await joinClub(me.id, clubId);
              load();
            }}
            className="mt-3 rounded-xl px-6 py-2.5 text-[13.5px] font-extrabold"
            style={
              joined
                ? { background: "rgba(255,255,255,.1)", color: "#a8cca8", border: "1px solid #4a9a6a" }
                : { background: "#d4b96a", color: "#1a2432" }
            }
          >
            {joined ? "✓ 入部中（タップで退部）" : "入部する"}
          </button>
        )}
        {/* マイページと同じ文法: 右下にカメラボタン(背景) */}
        {me && joined && (
          <>
            <label className="absolute bottom-2.5 right-3 cursor-pointer rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm">
              {lookBusy === "cover" ? "⏳" : (
                <span className="flex items-center gap-1.5"><CameraIcon size={14} /> 背景を変える</span>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setCropSrc({ kind: "cover", file: f });
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
      </header>
      {/* 切り抜き(マイページと同じPhotoCropper) */}
      {cropSrc && me && (
        <PhotoCropper
          file={cropSrc.file}
          aspect={cropSrc.kind === "cover" ? 2.4 : 1}
          outWidth={cropSrc.kind === "cover" ? 1080 : 256}
          onDone={async (blob) => {
            const kind = cropSrc.kind;
            setCropSrc(null);
            if (!blob || !me) return;
            setLookBusy(kind);
            const file = new File([blob], kind + ".jpg", { type: "image/jpeg" });
            const url = await uploadImage("post-images", me.id, file, kind === "cover" ? 1080 : 256, 0.72);
            if (url) {
              const supabase = createClient();
              await supabase.rpc("set_club_look", { cid: clubId, cover: kind === "cover" ? url : null, icon: kind === "icon" ? url : null });
              await load();
            }
            setLookBusy(null);
          }}
        />
      )}

      <div className="space-y-3.5 pt-4">
        {/* 部員 */}
        <section className="card">
          <div className="mb-2 text-[12px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
            部員
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m: any, i) => {
              const p = m.profiles;
              const inner = p?.avatar_url ? (
                <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
                >
                  <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
                </div>
              );
              return p?.username ? (
                <Link key={i} href={`/u/${p.username}`}>
                  {inner}
                </Link>
              ) : (
                <span key={i}>{inner}</span>
              );
            })}
            {members.length === 0 && <p className="text-[12px] text-[#a0aca0]">まだ部員がいません — 一人目になろう</p>}
          </div>
        </section>

        {/* 活動記録 */}
        <section className="card">
          <div className="mb-2 text-[12px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
            活動記録
          </div>
          {me && joined && (
            <div className="mb-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="今日の活動・写真・つぎの予定など"
                className="w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[#4a8a5c]"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                  <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2eae0] bg-white px-3 py-1.5 text-[11.5px] font-bold" style={{ color: GREEN }}>
                    {uploading ? "⏳" : <CameraIcon size={15} />}
                    写真
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f || !me) return;
                        setUploading(true);
                        setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55));
                        setUploading(false);
                      }}
                    />
                  </label>
                </div>
                <button
                  onClick={submit}
                  disabled={!body.trim() || sending || uploading}
                  className="rounded-xl px-4 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-40"
                  style={{ background: "#4a8a5c" }}
                >
                  {sending ? "記録中..." : "記録する"}
                </button>
              </div>
            </div>
          )}
          {posts.length === 0 ? (
            <p className="py-1 text-[12.5px] text-[#a0aca0]">まだ記録がありません</p>
          ) : (
            posts.map((p: any) => (
              <div key={p.id} className="border-b border-[#eef2ec] py-2.5">
                <div className="flex items-center gap-2">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
                  )}
                  <span className="text-[12px] font-bold text-[#3a4a34]">{p.profiles?.display_name ?? "むらびと"}</span>
                  <span className="num ml-auto text-[10px] text-[#c0c8c0]">
                    {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#5a5448]">{p.body}</p>
                {p.photo_url && <img src={p.photo_url} alt="" loading="lazy" className="mt-1.5 max-h-72 rounded-lg object-cover" />}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
