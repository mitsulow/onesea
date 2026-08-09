"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateChat, sendMessage } from "@/lib/line";
import { uploadImage } from "@/lib/images";
import { SnsIcon } from "@/components/SnsIcon";
import { EmbedCard } from "@/components/EmbedCard";
import {
  joinVillage,
  approveVillageMember,
  rejectVillageMember,
  updateVillage,
  POLICY_LABEL,
  PREFS,
  OVERSEAS_AREAS,
  fetchSettings,
  Village,
  VillagePostComment,
  fetchVillagePostComments,
  addVillagePostComment,
} from "@/lib/sekai";
import { CameraIcon } from "@/components/CameraIcon";
import JP_CITIES_JSON from "@/data/jp-cities.json";
import { linkify, SekaiMenuButton } from "@/components/sekai/sections";
import { srcCdn } from "@/lib/images";

const JP_CITIES = JP_CITIES_JSON as Record<string, string[]>;

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

const GREEN = "#3a7a4c";

/** 村のページ — 村人・囲炉裏（掲示板）・村長への連絡 */
export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const villageId = params.id;
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [amOffice, setAmOffice] = useState(false); // 事務局は投稿削除できる
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmOffice)).catch(() => {});
  }, [me]);
  const [village, setVillage] = useState<any | null | undefined>(undefined);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  /* 投稿へのコメント */
  const [cmts, setCmts] = useState<Record<string, VillagePostComment[]>>({});
  const [cOpen, setCOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cSending, setCSending] = useState<string | null>(null);
  /* 拠点の修正（立ち上げ村長のみ） */
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState("");
  const [ePref, setEPref] = useState("東京都");
  const [eCity, setECity] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePolicy, setEPolicy] = useState<Village["policy"]>("open");
  const [eSaving, setESaving] = useState(false);
  const [eCover, setECover] = useState<string | null>(null);
  const [eCoverUp, setECoverUp] = useState(false);
  const eIsJapan = (PREFS as readonly string[]).includes(ePref);

  const openEdit = () => {
    if (!village) return;
    setEName(village.name ?? "");
    setEPref(village.prefecture ?? "東京都");
    setECity(village.city ?? "");
    setEDesc(village.description ?? "");
    setEPolicy(village.policy ?? "open");
    setECover(village.cover_url ?? null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!me || !eName.trim() || eSaving) return;
    if (eIsJapan && !eCity) return;
    setESaving(true);
    await updateVillage(me.id, villageId, {
      name: eName.trim(),
      prefecture: ePref,
      city: eIsJapan ? eCity : null,
      description: eDesc.trim() || null,
      policy: ePolicy,
      cover_url: eCover,
    });
    setESaving(false);
    setEditing(false);
    load();
  };

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: v }, { data: m }, { data: p }, { data: session }] = await Promise.all([
      supabase
        .from("villages")
        .select("*, profiles!villages_created_by_fkey(username, display_name, avatar_url)")
        .eq("id", villageId)
        .maybeSingle(),
      supabase
        .from("village_members")
        .select("user_id, status, profiles!village_members_user_id_fkey(username, display_name, avatar_url)")
        .eq("village_id", villageId)
        .limit(80),
      supabase
        .from("village_posts")
        .select("id, body, photo_url, created_at, user_id, profiles!village_posts_user_id_fkey(username, display_name, avatar_url)")
        .eq("village_id", villageId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.auth.getSession().then((r) => ({ data: r.data.session })),
    ]);
    setVillage(v ?? null);
    setMembers(m ?? []);
    setPosts(p ?? []);
    // 各投稿へのコメントも読み込む（フィードと共通のデータ）
    const cs = await fetchVillagePostComments((p ?? []).map((x: any) => x.id));
    const map: Record<string, VillagePostComment[]> = {};
    for (const c of cs) (map[c.post_id] = map[c.post_id] ?? []).push(c);
    setCmts(map);
    const u = session?.user ?? null;
    setMe(u);
    if (u) setJoined((m ?? []).some((x: any) => x.user_id === u.id && x.status === "approved"));
  }, [villageId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendCmt = async (postId: string) => {
    const text = (drafts[postId] ?? "").trim();
    if (!me || !text || cSending) return;
    setCSending(postId);
    await addVillagePostComment(postId, me.id, text);
    setDrafts((d) => ({ ...d, [postId]: "" }));
    setCSending(null);
    const list = await fetchVillagePostComments([postId]);
    setCmts((m) => ({ ...m, [postId]: list }));
  };

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    const supabase = createClient();
    await supabase.from("village_posts").insert({ village_id: villageId, user_id: me.id, body: body.trim(), photo_url: photo });
    setBody("");
    setPhoto(null);
    setSending(false);
    load();
  };

  if (village === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4a8a5c] border-t-transparent" />
      </div>
    );
  }
  if (village === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-[#8a8070]">この村は見つかりませんでした</p>
        <Link href="/sekai" className="mt-4 inline-block text-sm underline" style={{ color: GREEN }}>
          セカイムラへもどる
        </Link>
      </div>
    );
  }

  const steward = village.profiles;

  return (
    <main className="pb-20">
      <SekaiMenuButton floating />
      <header
        className="px-4 pb-5 pt-4 text-center"
        style={{
          background: village.cover_url
            ? `linear-gradient(165deg, rgba(10,22,14,.72) 0%, rgba(14,32,20,.78) 60%, rgba(20,44,30,.85) 100%), url(${village.cover_url}) center/cover`
            : "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <Link href="/sekai" className="text-[13px] font-bold text-[#a8cca8] no-underline">
            ◀ セカイムラ
          </Link>
          <span className="flex items-center gap-1.5">
            {village.is_official && (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold"
                style={{ background: "#d4b96a", color: "#1a2432" }}
              >
                🏛 公式拠点
              </span>
            )}
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-[#a8cca8]">
              {POLICY_LABEL[village.policy as keyof typeof POLICY_LABEL] ?? village.policy}
            </span>
          </span>
        </div>
        {/* 拠点(=ページ)のアイコン。村長はタップして変更できる */}
        <div className="mt-3 flex justify-center">
          <label className={me && village.created_by === me.id ? "relative cursor-pointer" : "relative"}>
            {village.icon_url ? (
              <img
                src={srcCdn(village.icon_url)}
                alt=""
                className="h-[76px] w-[76px] rounded-full border-4 border-white/60 object-cover shadow-lg"
              />
            ) : (
              <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white/40 text-[34px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>
                🏡
              </span>
            )}
            {me && village.created_by === me.id && (
              <>
                <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[13px] shadow">
                  📷
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me) return;
                    const { uploadImage } = await import("@/lib/images");
                    const url = await uploadImage("post-images", me.id, f, 512, 0.8);
                    if (url) {
                      const supabase = createClient();
                      await supabase.from("villages").update({ icon_url: url }).eq("id", villageId).eq("created_by", me.id);
                      load();
                    }
                  }}
                />
              </>
            )}
          </label>
        </div>
        <h1 className="mt-2 text-[21px] font-extrabold tracking-[2px] text-[#eaf2e6]">{village.name}</h1>
        <div className="mt-1 text-[11.5px] text-[#a8cca8]">
          {village.prefecture} ・ 村人 {members.length}人 ・ 村長 {steward?.display_name ?? "—"}
        </div>
        {village.description && (
          <p className="mx-auto mt-2 max-w-[340px] text-[12px] leading-relaxed text-[#c8dcc8]">{village.description}</p>
        )}
        <VillageSns village={village} isLeader={!!me && village.created_by === me.id} onSaved={load} villageId={villageId} />
        <div className="mt-3 flex justify-center gap-2">
          {village.recruiting === false && !joined && (
            <span className="rounded-xl border border-white/20 px-4 py-2.5 text-[12px] font-bold text-[#a8b8a8]">現在は募集を締め切っています</span>
          )}
          {village.recruiting !== false && me && !joined && !members.some((mm: any) => mm.user_id === me.id) && (
            <button
              onClick={async () => {
                await joinVillage(me.id, villageId);
                // 村長へTalKで申請通知
                try {
                  if (village.created_by && village.created_by !== me.id) {
                    const chatId = await getOrCreateChat(me.id, village.created_by);
                    if (chatId) {
                      const supabase = createClient();
                      const { data: p } = await supabase.from("profiles").select("display_name").eq("id", me.id).maybeSingle();
                      await sendMessage(chatId, me.id, `【参加申請】${p?.display_name ?? "どなたか"}さんが「${village.name}」への参加を申請しました。村ページの村人アイコンから承認・却下できます → https://onesea.vercel.app/sekai/village/${villageId}`);
                    }
                  }
                } catch {}
                load();
              }}
              className="rounded-xl px-6 py-2.5 text-[13.5px] font-extrabold"
              style={{ background: "#d4b96a", color: "#1a2432" }}
            >
              この村に参加したいので村長へ申請
            </button>
          )}
          {me && !joined && members.some((mm: any) => mm.user_id === me.id && mm.status === "pending") && (
            <span className="rounded-xl border border-[#c8a860] px-4 py-2.5 text-[12.5px] font-bold text-[#e8d5a0]">申請中（村長の承認待ち）</span>
          )}
          {joined && <span className="rounded-xl border border-[#4a9a6a] px-4 py-2.5 text-[12.5px] font-bold text-[#a8d8b8]">✓ あなたの村</span>}
          {joined && me && village.created_by !== me.id && (
            <label className="cursor-pointer rounded-xl border border-white/25 px-4 py-2.5 text-[12.5px] font-bold text-[#c8dcc8]">
              背景を変更
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !me) return;
                const url = await uploadImage("post-images", me.id, f, 1600, 0.75);
                if (url) {
                  const supabase = createClient();
                  await supabase.rpc("set_village_cover", { vid: villageId, url });
                  load();
                }
              }} />
            </label>
          )}
          {me && village.created_by === me.id && (
            <button
              onClick={async () => {
                const supabase = createClient();
                await supabase.rpc("set_village_recruiting", { vid: villageId, r: village.recruiting === false });
                load();
              }}
              className="rounded-xl border border-white/25 px-3 py-2.5 text-[12px] font-bold text-[#c8dcc8]"
            >
              {village.recruiting === false ? "募集を再開する" : "募集を締め切る"}
            </button>
          )}
          {me && village.created_by === me.id && (
            <button
              onClick={openEdit}
              className="rounded-xl border border-white/25 px-4 py-2.5 text-[12.5px] font-bold text-[#c8dcc8]"
            >
              ✎ 修正する
            </button>
          )}
          {me && steward && village.created_by && me.id !== village.created_by && (
            <button
              onClick={async () => {
                const chatId = await getOrCreateChat(me.id, village.created_by);
                if (chatId) router.push(`/talk/${chatId}`);
              }}
              className="rounded-xl border border-white/25 px-4 py-2.5 text-[12.5px] font-bold text-[#c8dcc8]"
            >
              立ち上げ村長に連絡する
            </button>
          )}
        </div>

        {/* 公式拠点の申請（立ち上げ村長だけに見える） */}
        {me && village.created_by === me.id && !village.is_official && (
          <button
            onClick={async () => {
              const settings = await fetchSettings();
              const admin = settings.admin_user_id;
              if (!admin) {
                alert("公式拠点の申請窓口は準備中です（事務局の管理者が設定され次第、ここから申請できます）");
                return;
              }
              const chatId = await getOrCreateChat(me.id, admin);
              if (chatId) {
                await sendMessage(
                  chatId,
                  me.id,
                  `🏛 公式拠点の申請\n「${village.name}」（${village.prefecture}）をセカイムラ公式拠点として申請します。よろしくお願いします。`
                );
                router.push(`/talk/${chatId}`);
              }
            }}
            className="mx-auto mt-3 block rounded-xl border px-5 py-2.5 text-[12.5px] font-extrabold"
            style={{ borderColor: "#d4b96a88", color: "#e8d5a0", background: "rgba(212,185,106,.1)" }}
          >
            🏛 公式拠点を事務局に申請する
          </button>
        )}
      </header>

      {/* 拠点の修正フォーム */}
      {editing && (
        <div className="mt-4 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
          <div className="mb-2 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
            ✎ 拠点を修正する
          </div>
          <input
            value={eName}
            onChange={(e) => setEName(e.target.value)}
            placeholder="拠点名"
            className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#4a8a5c]"
          />
          <select
            value={ePref}
            onChange={(e) => {
              setEPref(e.target.value);
              setECity("");
            }}
            className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
          >
            <optgroup label="日本（47都道府県）">
              {PREFS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </optgroup>
            <optgroup label="海外">
              {OVERSEAS_AREAS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </optgroup>
          </select>
          {eIsJapan && (
            <select
              value={eCity}
              onChange={(e) => setECity(e.target.value)}
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
            >
              <option value="">市区町村を選ぶ *</option>
              {(JP_CITIES[ePref] ?? []).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <textarea
            value={eDesc}
            onChange={(e) => setEDesc(e.target.value)}
            rows={2}
            placeholder="どんな集まりにしたい？"
            className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-[#4a8a5c]"
          />
          {/* ヘッダー画像 */}
          <div className="mb-2 flex items-center gap-2">
            {eCover && <img src={srcCdn(eCover)} alt="" className="h-12 w-20 rounded-lg object-cover" />}
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2eae0] bg-white px-3 py-2 text-[12px] font-bold" style={{ color: GREEN }}>
              {eCoverUp ? "⏳" : "🖼"} ヘッダー画像を選ぶ
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !me) return;
                  setECoverUp(true);
                  setECover(await uploadImage("post-images", me.id, f, 1600, 0.75));
                  setECoverUp(false);
                }}
              />
            </label>
            {eCover && (
              <button onClick={() => setECover(null)} className="text-[11px] text-[#c05030]">
                外す
              </button>
            )}
          </div>
          <select
            value={ePolicy}
            onChange={(e) => setEPolicy(e.target.value as Village["policy"])}
            className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
          >
            <option value="open">誰でも参加OK</option>
            <option value="approval">申請・承認制</option>
            <option value="invite">招待制</option>
          </select>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
              キャンセル
            </button>
            <button
              onClick={saveEdit}
              disabled={!eName.trim() || (eIsJapan && !eCity) || eSaving}
              className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
              style={{ background: "#4a8a5c" }}
            >
              {eSaving ? "保存中..." : "保存する"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3.5 pt-4">
        {/* 村人 */}
        <section className="card">
          <div className="mb-2 text-[12px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
            {village.name}の村人
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m: any, i) => {
              const p = m.profiles;
              const pending = m.status === "pending";
              const isLeader = me && village.created_by === me.id;
              const inner = (
                <span className="relative inline-block">
                  {p?.avatar_url ? (
                    <img src={srcCdn(p.avatar_url)} alt="" referrerPolicy="no-referrer" className={"h-10 w-10 rounded-full object-cover" + (pending ? " opacity-50 grayscale" : "")} />
                  ) : (
                    <span className={"flex h-10 w-10 items-center justify-center rounded-full" + (pending ? " opacity-50" : "")} style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}>
                      <img src="/icons/icon-leaf.webp" alt="" style={{ width: 18, height: 18 }} />
                    </span>
                  )}
                  {pending && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#c8a860] px-1 text-[7.5px] font-bold text-white">申請中</span>
                  )}
                </span>
              );
              return (
                <span key={i} className="flex flex-col items-center gap-0.5">
                  {p?.username ? <Link href={`/u/${p.username}`}>{inner}</Link> : inner}
                  {pending && isLeader && (
                    <span className="flex gap-1">
                      <button
                        onClick={async () => {
                          await approveVillageMember(villageId, m.user_id);
                          // 本人へTalKで承認通知 + グループTalKに歓迎メッセージ
                          try {
                            const supabase = createClient();
                            const { data: p2 } = await supabase.from("profiles").select("display_name").eq("id", m.user_id).maybeSingle();
                            const chatId = await getOrCreateChat(me!.id, m.user_id);
                            if (chatId) await sendMessage(chatId, me!.id, `「${village.name}」への参加が承認されました！ようこそ🎉 グループTalKでみんなと話せます → https://onesea.vercel.app/talk/g/village/${villageId}`);
                            await supabase.from("group_messages").insert({ scope_type: "village", scope_id: villageId, sender_id: me!.id, body: `🎉 ${p2?.display_name ?? "新しい村人"}さんが「${village.name}」に加わりました！` });
                          } catch {}
                          load();
                        }}
                        className="rounded bg-[#4a9a6a] px-1.5 py-0.5 text-[9px] font-bold text-white"
                      >承認</button>
                      <button
                        onClick={async () => { await rejectVillageMember(villageId, m.user_id); load(); }}
                        className="rounded bg-[#8a8070] px-1.5 py-0.5 text-[9px] font-bold text-white"
                      >却下</button>
                    </span>
                  )}
                </span>
              );
            })}
            {members.length === 0 && <p className="text-[12px] text-[#a0aca0]">まだ村人がいません</p>}
          </div>
        </section>

        {/* 囲炉裏 */}
        <section className="card">
          <div className="mb-2 text-[12px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
            {village.name}の活動
          </div>
          {posts.length === 0 ? (
            <p className="py-1 text-[12.5px] text-[#a0aca0]">まだ活動の記録がありません。村人日記から投稿すると、ここに並びます</p>
          ) : (
            posts.map((p: any) => (
              <div key={p.id} className="border-b border-[#eef2ec] py-2.5">
                <div className="flex items-center gap-2">
                  {p.profiles?.avatar_url ? (
                    <img src={srcCdn(p.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
                  )}
                  <span className="text-[12px] font-bold text-[#3a4a34]">{p.profiles?.display_name ?? "むらびと"}</span>
                  <span className="num ml-auto text-[10px] text-[#c0c8c0]">
                    {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}
                  </span>
                  {me && amOffice && (
                    <button
                      onClick={async () => {
                        if (!confirm("【事務局権限】この村の投稿を削除しますか？")) return;
                        const supabase = createClient();
                        await supabase.from("village_posts").delete().eq("id", p.id);
                        load();
                      }}
                      className="ml-1 text-[9px] font-bold text-[#c05030] underline"
                    >削除</button>
                  )}
                  {me && (
                    <button
                      onClick={async () => {
                        const reason = prompt("この投稿の削除を事務局に依頼します。理由を教えてください");
                        if (reason === null) return;
                        const supabase = createClient();
                        await supabase.from("post_reports").insert({ kind: "village_post", target_id: p.id, target_url: `/sekai/village/${villageId}`, excerpt: String(p.body ?? "").slice(0, 120), reporter: me.id, reason: reason || null });
                        alert("事務局に削除依頼を送りました");
                      }}
                      className="ml-1 text-[9px] text-[#c0c8c0] underline"
                    >通報</button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#5a5448]">
                  {linkify(String(p.body ?? ""))}
                </p>
                {p.photo_url && <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-1.5 max-h-72 rounded-lg object-cover" />}
                {(() => { const eu = bodyEmbedUrl(p.body); return eu ? <EmbedCard embed={{ url: eu }} /> : null; })()}

                {/* コメント（5件まで表示、以降は折りたたみ） */}
                {(() => {
                  const list = cmts[p.id] ?? [];
                  const open = cOpen.has(p.id);
                  const shown = open ? list : list.slice(0, 5);
                  return (
                    <div className="mt-2">
                      {shown.map((c: any) => (
                        <div key={c.id} className="mb-1.5 flex items-start gap-1.5">
                          {c.profiles?.avatar_url ? (
                            <img src={srcCdn(c.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-5 w-5 flex-shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f0e4] text-[10px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
                          )}
                          <div className="min-w-0 flex-1 rounded-lg bg-[#f4f8f2] px-2 py-1">
                            <span className="mr-1.5 text-[10px] font-bold text-[#5a7a5c]">
                              {c.profiles?.display_name ?? "むらびと"}
                            </span>
                            <span className="break-words text-[12px] leading-relaxed text-[#4a4438]">{c.body}</span>
                          </div>
                        </div>
                      ))}
                      {list.length > 5 && (
                        <button
                          onClick={() =>
                            setCOpen((s) => {
                              const n = new Set(s);
                              if (open) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                          className="mb-1.5 text-[11px] font-bold underline"
                          style={{ color: GREEN }}
                        >
                          {open ? "たたむ" : `もっと見る（あと${list.length - 5}件）`}
                        </button>
                      )}
                      {me && (
                        <div className="flex items-end gap-1.5">
                          <input
                            value={drafts[p.id] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                            placeholder="コメントする..."
                            className="min-w-0 flex-1 rounded-full border border-[#e2eae0] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[#4a8a5c]"
                          />
                          <button
                            onClick={() => sendCmt(p.id)}
                            disabled={!(drafts[p.id] ?? "").trim() || cSending === p.id}
                            className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-40"
                            style={{ background: "#4a8a5c" }}
                          >
                            送る
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}


/** 村のSNSリンク（表示は全員・編集は村長） */
function VillageSns({ village, isLeader, onSaved, villageId }: { village: any; isLeader: boolean; onSaved: () => void; villageId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const sns = (village.sns as Record<string, string>) ?? {};
  const keys = ["instagram", "x", "youtube", "line", "website"] as const;
  const labels: Record<string, string> = { instagram: "Instagram", x: "X", youtube: "YouTube", line: "LINE公式", website: "ウェブサイト" };
  const entries = Object.entries(sns).filter(([, v]) => v);
  if (!isLeader && entries.length === 0) return null;
  return (
    <div className="mx-auto mt-2 max-w-[340px]">
      {entries.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          {entries.map(([k, v]) => (
            <a key={k} href={v} target="_blank" rel="noopener noreferrer" className="opacity-90">
              <SnsIcon platform={k} size={22} />
            </a>
          ))}
        </div>
      )}
      {isLeader && !editing && (
        <button onClick={() => { setDraft({ ...sns }); setEditing(true); }} className="mx-auto mt-1.5 block text-[10.5px] font-bold text-[#8ab89a] underline">
          この村のSNSを編集
        </button>
      )}
      {editing && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-black/25 p-2.5 text-left">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="flex w-20 flex-shrink-0 items-center gap-1 text-[10px] text-[#c8dcc8]">
                <SnsIcon platform={k} size={14} />{labels[k]}
              </span>
              <input
                value={draft[k] ?? ""}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[11px] text-white outline-none"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(false)} className="flex-1 rounded-lg border border-white/20 py-1.5 text-[11px] font-bold text-[#c8dcc8]">キャンセル</button>
            <button
              onClick={async () => {
                const clean: Record<string, string> = {};
                for (const [k, v] of Object.entries(draft)) if (v.trim()) clean[k] = v.trim();
                const supabase = createClient();
                await supabase.rpc("set_village_sns", { vid: villageId, s: clean });
                setEditing(false);
                onSaved();
              }}
              className="flex-1 rounded-lg bg-[#d4b96a] py-1.5 text-[11px] font-extrabold text-[#1a2432]"
            >保存する</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 本文中の最初のURLをインスタ/X/YouTube埋め込みに（コトヅテと同じEmbedCard） */
export function bodyEmbedUrl(body: string | null): string | null {
  if (!body) return null;
  const m = body.match(/https?:\/\/[^\s]+/);
  if (!m) return null;
  const u = m[0];
  if (/instagram\.com|youtu\.be|youtube\.com|twitter\.com|x\.com/.test(u)) return u;
  return null;
}
