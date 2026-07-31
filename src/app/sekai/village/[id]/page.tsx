"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateChat, sendMessage } from "@/lib/line";
import { uploadImage } from "@/lib/images";
import { joinVillage, updateVillage, POLICY_LABEL, PREFS, OVERSEAS_AREAS, fetchSettings, Village } from "@/lib/sekai";
import { CameraIcon } from "@/components/CameraIcon";
import JP_CITIES_JSON from "@/data/jp-cities.json";

const JP_CITIES = JP_CITIES_JSON as Record<string, string[]>;

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

const GREEN = "#3a7a4c";

/** 村のページ — 村人・囲炉裏（掲示板）・世話人への連絡 */
export default function VillagePage() {
  const params = useParams<{ id: string }>();
  const villageId = params.id;
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [village, setVillage] = useState<any | null | undefined>(undefined);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  /* 拠点の修正（立ち上げ村長のみ） */
  const [editing, setEditing] = useState(false);
  const [eName, setEName] = useState("");
  const [ePref, setEPref] = useState("東京都");
  const [eCity, setECity] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [ePolicy, setEPolicy] = useState<Village["policy"]>("open");
  const [eSaving, setESaving] = useState(false);
  const eIsJapan = (PREFS as readonly string[]).includes(ePref);

  const openEdit = () => {
    if (!village) return;
    setEName(village.name ?? "");
    setEPref(village.prefecture ?? "東京都");
    setECity(village.city ?? "");
    setEDesc(village.description ?? "");
    setEPolicy(village.policy ?? "open");
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
        .select("user_id, profiles!village_members_user_id_fkey(username, display_name, avatar_url)")
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
    const u = session?.user ?? null;
    setMe(u);
    if (u) setJoined((m ?? []).some((x: any) => x.user_id === u.id));
  }, [villageId]);

  useEffect(() => {
    load();
  }, [load]);

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
      <header
        className="px-4 pb-5 pt-4 text-center"
        style={{ background: "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)" }}
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
        <div className="mt-3 text-[40px] leading-none">⛺</div>
        <h1 className="mt-2 text-[21px] font-extrabold tracking-[2px] text-[#eaf2e6]">{village.name}</h1>
        <div className="mt-1 text-[11.5px] text-[#a8cca8]">
          {village.prefecture} ・ 村人 {members.length}人 ・ 世話人 {steward?.display_name ?? "—"}
        </div>
        {village.description && (
          <p className="mx-auto mt-2 max-w-[340px] text-[12px] leading-relaxed text-[#c8dcc8]">{village.description}</p>
        )}
        <div className="mt-3 flex justify-center gap-2">
          {me && !joined && village.policy === "open" && (
            <button
              onClick={async () => {
                await joinVillage(me.id, villageId);
                load();
              }}
              className="rounded-xl px-6 py-2.5 text-[13.5px] font-extrabold"
              style={{ background: "#d4b96a", color: "#1a2432" }}
            >
              この村に入る
            </button>
          )}
          {joined && <span className="rounded-xl border border-[#4a9a6a] px-4 py-2.5 text-[12.5px] font-bold text-[#a8d8b8]">✓ あなたの村</span>}
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
                if (chatId) router.push(`/line/${chatId}`);
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
                router.push(`/line/${chatId}`);
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
              やめる
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
            この村の村人
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m: any, i) => {
              const p = m.profiles;
              const inner = p?.avatar_url ? (
                <img src={p.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-lg" style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}>
                  🌿
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
            {members.length === 0 && <p className="text-[12px] text-[#a0aca0]">まだ村人がいません</p>}
          </div>
        </section>

        {/* 囲炉裏 */}
        <section className="card">
          <div className="mb-2 text-[12px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
            🔥 囲炉裏 <span className="text-[10px] font-normal text-[#a0aca0]">この村の掲示板</span>
          </div>
          {me && joined && (
            <div className="mb-3">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={2}
                placeholder="次の集まり・持ち寄り・写真など"
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
                        setPhoto(await uploadImage("post-images", me.id, f));
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
                  {sending ? "投稿中..." : "投稿する"}
                </button>
              </div>
            </div>
          )}
          {posts.length === 0 ? (
            <p className="py-1 text-[12.5px] text-[#a0aca0]">まだ火が入っていません。最初のひとことを 🔥</p>
          ) : (
            posts.map((p: any) => (
              <div key={p.id} className="border-b border-[#eef2ec] py-2.5">
                <div className="flex items-center gap-2">
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg">🌿</span>
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
