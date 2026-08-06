"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPosts, fetchMyLikes } from "@/lib/cotozute";
import { getOrCreateChat } from "@/lib/line";
import { uploadImage, uploadCroppedBlob } from "@/lib/images";
import { PhotoCropper } from "@/components/PhotoCropper";
import { Shop, fetchShopsByOwner, categoryOf, Reco, fetchRecos, addReco, deleteReco } from "@/lib/za";
import { SnsIcon } from "@/components/SnsIcon";
import { CameraIcon } from "@/components/CameraIcon";
import { PostCard } from "@/components/PostCard";
import { AvatarMenu } from "@/components/AvatarMenu";
import { srcCdn } from "@/lib/images";
import { isWarawaUntil } from "@/lib/warawa";
import { WarawaBadge } from "@/components/WarawaBadge";
import { PremiumSetupCard } from "@/components/PremiumSetupCard";
import { MyRecoMap } from "@/components/MyRecoMap";

interface FullProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  status_line: string | null;
  prefecture: string | null;
  city: string | null;
  rice_work: string | null;
  life_work: string | null;
  skills: string[] | null;
  wants_to_do: string[] | null;
  sns: Record<string, string> | null;
  member_no: number | null;
  created_at: string | null;
  birthday: string | null;
  warawa_until: string | null;
}

/** むらびとのマイページ（楽市楽座の名刺スタイル: カバー画像 + 重なるアバター） */
export default function UserPage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const username = decodeURIComponent(params.username);
  const [profile, setProfile] = useState<FullProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [busy, setBusy] = useState<"cover" | "avatar" | null>(null);
  const [cropping, setCropping] = useState<{ kind: "cover" | "avatar"; file: File } | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [recos, setRecos] = useState<Reco[]>([]);
  const [recoForm, setRecoForm] = useState(false);
  const [recoTitle, setRecoTitle] = useState("");
  const [recoUrl, setRecoUrl] = useState("");
  const [recoComment, setRecoComment] = useState("");
  const [recoSaving, setRecoSaving] = useState(false);
  const [stats, setStats] = useState<{ posts: number; leaves: number } | null>(null);
  const [masterDdp, setMasterDdp] = useState<string | null>(null);
  const [dailyDdps, setDailyDdps] = useState<Array<{ day: string; body: string; fulfilled_pct: number | null }>>([]);
  const pctTimers = useRef<Record<string, number>>({});
  const [ddpOpen, setDdpOpen] = useState(false);
  const [ideas, setIdeas] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, bio, status_line, prefecture, city, rice_work, life_work, skills, wants_to_do, sns, member_no, created_at, birthday, warawa_until")
      .eq("username", username)
      .maybeSingle();
    const prof = (data as FullProfile) ?? null;
    setProfile(prof);
    if (prof) {
      fetchShopsByOwner(prof.id).then(setShops);
      fetchRecos(prof.id).then(setRecos);
      // 実績カウント（言の葉数・もらった🌱）
      (async () => {
        const { count: pc } = await supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", prof.id);
        const { data: pids } = await supabase.from("posts").select("id").eq("user_id", prof.id).limit(1000);
        let leaves = 0;
        if (pids && pids.length > 0) {
          const { count: lc } = await supabase
            .from("likes")
            .select("post_id", { count: "exact", head: true })
            .in("post_id", pids.map((r) => r.id));
          leaves = lc ?? 0;
        }
        setStats({ posts: pc ?? 0, leaves });
      })();
      supabase.from("ddp").select("body").eq("user_id", prof.id).maybeSingle().then(({ data: d }) => setMasterDdp(d?.body ?? null));
      supabase
        .from("daily_ddp")
        .select("day, body, fulfilled_pct")
        .eq("user_id", prof.id)
        .order("day", { ascending: false })
        .limit(120)
        .then(({ data: dd }) =>
          setDailyDdps((dd as Array<{ day: string; body: string; fulfilled_pct: number | null }>) ?? [])
        );
      // アイディア一覧（RLSで本人にしか返らない）
      supabase
        .from("ideas")
        .select("id, body, created_at")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(120)
        .then(({ data: ii }) => setIdeas((ii as Array<{ id: string; body: string; created_at: string }>) ?? []));
    }
  };

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
    loadProfile();
    fetchPosts(username).then(setPosts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // 写真を選んだら、まず位置調整・ズーム切り抜きへ
  const changeImage = (kind: "cover" | "avatar", file: File | null) => {
    if (!me || !file || busy) return;
    setCropping({ kind, file });
  };

  const onCropped = async (blob: Blob | null) => {
    const kind = cropping?.kind;
    setCropping(null);
    if (!me || !blob || !kind) return;
    setBusy(kind);
    const url = await uploadCroppedBlob("avatars", me.id, blob);
    if (url) {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update(kind === "cover" ? { cover_url: url } : { avatar_url: url })
        .eq("id", me.id);
      await loadProfile();
    }
    setBusy(null);
  };

  /* 叶った度（%）: スライダーを動かすとすぐ反映、保存は0.5秒デバウンス */
  const setPct = (day: string, pct: number) => {
    setDailyDdps((prev) => prev.map((d) => (d.day === day ? { ...d, fulfilled_pct: pct } : d)));
    if (pctTimers.current[day]) clearTimeout(pctTimers.current[day]);
    pctTimers.current[day] = window.setTimeout(async () => {
      if (!me) return;
      const supabase = createClient();
      await supabase.from("daily_ddp").update({ fulfilled_pct: pct }).eq("user_id", me.id).eq("day", day);
    }, 500);
  };

  const saveBio = async () => {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ bio: bioDraft.trim() || null }).eq("id", me.id);
    setEditingBio(false);
    loadProfile();
  };

  if (profile === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-[#8a8070]">このむらびとは見つかりませんでした</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[#c94d3a] underline">
          マイページへもどる
        </Link>
      </div>
    );
  }

  const isMe = me?.id === profile.id;
  const isWara = isWarawaUntil(profile.warawa_until);

  /* シンクロ単語の下に「何％叶ったか」— 本人は左右に動かしてすぐ選べる */
  const pctRow = (d: { day: string; body: string; fulfilled_pct: number | null }) =>
    isMe ? (
      <div className="mt-1.5 flex items-center gap-2">
        <span className="flex-shrink-0 text-[9px] tracking-wider text-[#a0aca0]">叶った度</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={d.fulfilled_pct ?? 0}
          onChange={(e) => setPct(d.day, Number(e.target.value))}
          className="h-1 min-w-0 flex-1 accent-[#0abab5]"
          aria-label="叶った度"
        />
        <span className="num w-11 flex-shrink-0 text-right text-[12px] font-extrabold text-[#0abab5]">
          {d.fulfilled_pct != null ? `${d.fulfilled_pct}%` : "—"}
        </span>
      </div>
    ) : d.fulfilled_pct != null ? (
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e4f0ee]">
          <div
            className="h-full rounded-full"
            style={{ width: `${d.fulfilled_pct}%`, background: "linear-gradient(90deg,#0abab5,#7ad8c8)" }}
          />
        </div>
        <span className="num flex-shrink-0 text-[11px] font-bold text-[#0abab5]">{d.fulfilled_pct}%叶った</span>
      </div>
    ) : null;

  return (
    <main className="pb-20">
      {cropping && (
        <PhotoCropper
          file={cropping.file}
          aspect={cropping.kind === "avatar" ? 1 : 2.6}
          outWidth={cropping.kind === "avatar" ? 512 : 1600}
          quality={0.8}
          title={cropping.kind === "avatar" ? "プロフィール写真の位置を調整" : "ヘッダー画像の位置を調整"}
          onDone={onCropped}
        />
      )}
      {/* カバー画像 */}
      <div className="relative h-44 w-full overflow-hidden">
        {profile.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={srcCdn(profile.cover_url)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "linear-gradient(160deg,#0e1e2e 0%,#17384e 60%,#1e4a66 100%)" }}
          />
        )}
        <button
          onClick={() => {
            // 直前のページへ（履歴がなければホームへ）
            if (window.history.length > 1) router.back();
            else router.push("/");
          }}
          className="absolute left-3 top-3 z-10 rounded-full bg-black/40 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur-sm"
        >
          ◀ もどる
        </button>
        <span className="absolute right-3 top-3 z-10">
          <AvatarMenu />
        </span>
        {isMe && (
          <>
            <button
              onClick={() => coverInput.current?.click()}
              className="absolute bottom-2.5 right-3 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
            >
              {busy === "cover" ? (
                "⏳"
              ) : (
                <span className="flex items-center gap-1.5">
                  <CameraIcon size={14} />
                  背景を変える
                </span>
              )}
            </button>
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)}
            />
          </>
        )}
      </div>

      {/* アバター + 名前 */}
      <div className="relative px-4">
        <div className="relative -mt-11 inline-block">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={srcCdn(profile.avatar_url)}
              alt=""
              referrerPolicy="no-referrer"
              className="h-[88px] w-[88px] rounded-full border-4 border-[#f2ede4] object-cover shadow-md"
            />
          ) : (
            <div
              className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-4 border-[#f2ede4] text-3xl shadow-md"
              style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
            >
              🌿
            </div>
          )}
          {isMe && (
            <>
              <button
                onClick={() => avatarInput.current?.click()}
                aria-label="アイコンを変える"
                className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#c94d3a] text-[12px] text-white shadow"
              >
                {busy === "avatar" ? "⏳" : <CameraIcon size={14} />}
              </button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => changeImage("avatar", e.target.files?.[0] ?? null)}
              />
            </>
          )}
        </div>

        <div className="mt-1.5">
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold leading-snug text-[#3a3428]">
            {profile.display_name ?? "むらびと"}
            {isWara && <WarawaBadge size={17} />}
          </h1>
          {/* @Warawer・わらわ〜No.はわらわ〜会員（認証済み）だけの称号 */}
          {isWara && profile.member_no != null && (
            <div className="text-[12px] text-[#a09888]">@Warawer{String(profile.member_no).padStart(7, "0")}</div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isWara && profile.member_no != null && (
              <span
                className="num rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wider text-[#7a5a10]"
                style={{ background: "linear-gradient(135deg,#f8e8b0,#e8cc70)", border: "1px solid #d4b96a" }}
              >
                わらわ〜No.{String(profile.member_no).padStart(7, "0")}
              </span>
            )}
            {profile.birthday && (
              <span className="num text-[11px] font-bold text-[#a09888]">
                🌏 地球冒険 {(Math.floor((Date.now() - new Date(profile.birthday + "T00:00:00+09:00").getTime()) / 86400000) + 1).toLocaleString()}日目
              </span>
            )}
          </div>
          {profile.status_line && (
            <div className="mt-0.5 text-[13px] font-medium text-[#5a5448]">{profile.status_line}</div>
          )}
          {(profile.prefecture || profile.city) && (
            <div className="mt-0.5 text-[12px] text-[#a09888]">
              {"\uD83D\uDCCD"} {profile.prefecture ?? ""}{profile.city ? " " + profile.city : ""}
            </div>
          )}
        </div>

        {/* わらわ〜会員の未入力情報（本人のみ・全部埋まるまでバッジが消えない） */}
        {isMe && <PremiumSetupCard userId={profile.id} />}

        {/* DDP（端的な夢） */}
        {masterDdp && (
          <div
            id="ddp-sec"
            className="mt-2.5 rounded-xl px-3.5 py-2.5"
            style={{ background: "linear-gradient(135deg,#e6f7f6,#fdfbf4)", border: "1px solid #0abab544" }}
          >
            <div className="text-[9.5px] font-bold tracking-[2px] text-[#0abab5]">🌊 DDP</div>
            <div className="mt-0.5 whitespace-pre-wrap text-[14px] font-bold leading-relaxed text-[#2a5a56]">{masterDdp}</div>
          </div>
        )}

        {/* 自己紹介 */}
        <div className="mt-2">
          {editingBio ? (
            <div>
              <textarea
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="自己紹介・やっていること・すきなこと"
                className="w-full resize-y rounded-xl border border-[#e8dcc4] bg-white p-3 text-[13.5px] leading-relaxed outline-none focus:border-[#c94d3a]"
              />
              <div className="mt-1 flex justify-end gap-2">
                <button onClick={() => setEditingBio(false)} className="px-3 py-1.5 text-[12px] font-bold text-[#a09888]">
                  キャンセル
                </button>
                <button
                  onClick={saveBio}
                  className="rounded-lg px-4 py-1.5 text-[12px] font-bold text-white"
                  style={{ background: "#c94d3a" }}
                >
                  保存
                </button>
              </div>
            </div>
          ) : profile.bio ? (
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#5a5448]">
              {profile.bio}
              {isMe && (
                <button
                  onClick={() => {
                    setBioDraft(profile.bio ?? "");
                    setEditingBio(true);
                  }}
                  className="ml-2 text-[11px] text-[#c94d3a] underline"
                >
                  編集
                </button>
              )}
            </p>
          ) : isMe ? (
            <button
              onClick={() => {
                setBioDraft("");
                setEditingBio(true);
              }}
              className="text-[12.5px] text-[#c94d3a] underline"
            >
              ＋ 自己紹介を書く
            </button>
          ) : null}
        </div>

        {/* アクション */}
        {me && !isMe && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                const chatId = await getOrCreateChat(me.id, profile.id);
                if (chatId) router.push(`/talk/${chatId}`);
              }}
              className="flex-1 rounded-xl py-3 text-[14px] font-extrabold text-white"
              style={{ background: "#c94d3a" }}
            >
              💬 連絡を取る
            </button>
          </div>
        )}

        {isMe && (
          <Link
            href="/settings/profile"
            className="mt-3 block rounded-xl border border-[#e0d6c6] bg-white py-2.5 text-center text-[13px] font-bold text-[#8a7a5a] no-underline"
          >
            ✏️ プロフィールを編集
          </Link>
        )}

        {profile.sns && Object.keys(profile.sns).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(profile.sns).map(([platform, url]) => (
              <a
                key={platform}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ede5d8] bg-white"
                aria-label={platform}
              >
                <SnsIcon platform={platform} size={22} />
              </a>
            ))}
          </div>
        )}

        {(profile.rice_work || profile.life_work) && (
          <div className="mt-3 space-y-1 rounded-xl border border-[#ede5d8] bg-white px-3 py-2.5">
            {profile.rice_work && (
              <div className="text-[12.5px] text-[#5a5448]">
                <span className="mr-1.5 text-[10.5px] font-bold text-[#a09888]">ライスワーク</span>
                {profile.rice_work}
              </div>
            )}
            {profile.life_work && (
              <div className="text-[12.5px] text-[#5a5448]">
                <span className="mr-1.5 text-[10.5px] font-bold text-[#a09888]">ライフワーク</span>
                {profile.life_work}
              </div>
            )}
          </div>
        )}
        {profile.skills && profile.skills.length > 0 && (
          <div className="mt-2.5">
            <div className="mb-1 text-[10.5px] font-bold tracking-wider text-[#a09888]">🛠 SKILL</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map((sk) => (
                <span key={sk} className="rounded-full bg-[#eaf1e6] px-2.5 py-1 text-[11.5px] font-medium text-[#4a6a3c]">
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}
        {profile.wants_to_do && profile.wants_to_do.length > 0 && (
          <div className="mt-2.5">
            <div className="mb-1 text-[10.5px] font-bold tracking-wider text-[#a09888]">✨ やりたいこと</div>
            <div className="flex flex-wrap gap-1.5">
              {profile.wants_to_do.map((w) => (
                <span key={w} className="rounded-full bg-[#fdf0ee] px-2.5 py-1 text-[11.5px] font-medium text-[#a05040]">
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {shops.length > 0 && (
        <div className="pt-5">
          <div className="card">
            <div className="sec mb-2.5 flex items-center gap-1.5"><img src="/rakuichi/logo-emblem.webp" alt="" className="inline-block h-[18px] w-[18px] rounded-full object-cover align-[-3px]" /><span>{isMe ? "わたしの出品一覧" : `${profile.display_name ?? "この人"}さんの出品一覧`}</span></div>
            <div className="grid grid-cols-2 gap-3">
              {shops.map((shop) => {
                const cat = categoryOf(shop.category);
                return (
                  <Link key={shop.id} href={`/za/${shop.id}`} className="block no-underline">
                    <div
                      className="relative flex h-full flex-col overflow-hidden rounded-md border border-[#ede5d8] shadow-sm"
                      style={{ background: "linear-gradient(180deg,#fffaf0,#fdf6e9)" }}
                    >
                      <div className="absolute left-0 right-0 top-0 z-10 h-[3px]" style={{ background: "#c94d3a" }} />
                      <div className="relative aspect-square overflow-hidden bg-[#f2ede4]">
                        {(shop.thumb_urls?.[0] ?? shop.image_urls[0]) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={srcCdn(shop.thumb_urls?.[0] ?? shop.image_urls[0])} alt={shop.name} className="h-full w-full object-cover" />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ background: "linear-gradient(135deg,#c94d3a 0%,#d4a043 50%,#5a7d4a 100%)" }}
                          >
                            <img src="/rakuichi/logo-emblem.webp" alt="" className="h-12 w-12 rounded-full object-cover opacity-90" />
                          </div>
                        )}
                        {cat && (
                          <div className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold">
                            {cat.emoji} {cat.label}
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <h3 className="line-clamp-1 text-[12px] font-bold leading-tight text-[#3a3428]">{shop.name}</h3>
                        <span className="text-[11px] font-bold" style={{ color: "#c94d3a" }}>
                          {shop.is_trial ? "0円〜" : shop.price_jpy != null ? "¥" + shop.price_jpy.toLocaleString() : "値段相談"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 私のおススメの店 — 地図（全員分はセカイムラのおススメマップに集計される） */}
      <div className="px-4">
        <MyRecoMap userId={profile.id} isMe={isMe} />
      </div>

      {/* わたしのおススメ（好きな農家さんのお米など外部リンク紹介） */}
      {(recos.length > 0 || isMe) && (
        <div className="pt-5" id="recos-sec" style={{ scrollMarginTop: 20 }}>
          <div className="card">
            <div className="sec mb-2.5 flex items-center justify-between">
              <span>⭐ {isMe ? "わたしのオススメ" : `${profile.display_name ?? "この人"}さんのオススメ`}</span>
              {isMe && !recoForm && (
                <button
                  onClick={() => setRecoForm(true)}
                  className="rounded-full border border-[#e0d5c0] bg-white px-2.5 py-1 text-[11px] font-bold text-[#8a7a5a]"
                >
                  ＋ 追加
                </button>
              )}
            </div>

            {isMe && recoForm && (
              <div className="mb-3 rounded-xl border border-[#e8dcc4] bg-[#fffbf0] p-3">
                <input
                  value={recoTitle}
                  onChange={(e) => setRecoTitle(e.target.value)}
                  maxLength={40}
                  placeholder="例: 田中農園の天日干しコシヒカリ"
                  className="w-full rounded-lg border border-[#e8dcc4] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#c94d3a]"
                />
                <input
                  value={recoUrl}
                  onChange={(e) => setRecoUrl(e.target.value)}
                  placeholder="リンク（https://...）※任意"
                  inputMode="url"
                  className="mt-1.5 w-full rounded-lg border border-[#e8dcc4] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#c94d3a]"
                />
                <textarea
                  value={recoComment}
                  onChange={(e) => setRecoComment(e.target.value)}
                  maxLength={80}
                  rows={2}
                  placeholder="おススメの理由（例: 甘みが違う。うちは10年これ）※任意"
                  className="mt-1.5 w-full resize-none rounded-lg border border-[#e8dcc4] bg-white px-3 py-2 text-[12.5px] leading-relaxed outline-none focus:border-[#c94d3a]"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setRecoForm(false)}
                    className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a09888]"
                  >
                    やめる
                  </button>
                  <button
                    onClick={async () => {
                      if (!me || !recoTitle.trim() || recoSaving) return;
                      setRecoSaving(true);
                      await addReco(me.id, recoTitle, recoUrl, recoComment);
                      setRecoTitle("");
                      setRecoUrl("");
                      setRecoComment("");
                      setRecoForm(false);
                      setRecoSaving(false);
                      setRecos(await fetchRecos(me.id));
                    }}
                    disabled={!recoTitle.trim() || recoSaving}
                    className="flex-1 rounded-xl py-2 text-[13px] font-extrabold text-white disabled:opacity-40"
                    style={{ background: "#c94d3a" }}
                  >
                    {recoSaving ? "保存中..." : "おススメする"}
                  </button>
                </div>
              </div>
            )}

            {recos.length === 0 && isMe && !recoForm ? (
              <p className="py-1 text-[12px] text-[#b8b0a0]">
                好きな農家さんのお米など、みんなに紹介したいものを並べられます
              </p>
            ) : (
              <div className="space-y-2">
                {recos.map((r) => (
                  <div key={r.id} className="rounded-xl border border-[#ede5d8] bg-[#fffaf0] px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-bold leading-snug text-[#3a3428]">{r.title}</div>
                        {r.comment && (
                          <div className="mt-0.5 text-[12px] leading-relaxed text-[#8a7a5a]">{r.comment}</div>
                        )}
                        {r.url && (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block max-w-full truncate rounded-full bg-[#f0e6d2] px-2.5 py-1 text-[11px] font-bold text-[#a05040] no-underline"
                          >
                            🔗 見てみる →
                          </a>
                        )}
                      </div>
                      {isMe && (
                        <button
                          onClick={async () => {
                            if (!me || !confirm("このおススメを削除しますか？")) return;
                            await deleteReco(r.id, me.id);
                            setRecos(await fetchRecos(me.id));
                          }}
                          aria-label="削除"
                          className="flex-shrink-0 px-1 text-[13px] text-[#c0b8a8]"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 言の葉 */}
      <div className="pt-5">
        <div className="card">
          <div className="sec mb-2">全ての投稿</div>
          {posts === null ? (
            <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
          ) : posts.length === 0 ? (
            <p className="py-1.5 text-[13px] text-[#b8b0a0]">まだ言の葉がありません</p>
          ) : (
            posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                me={me}
                liked={likedSet.has(p.id)}
                onDeleted={() => fetchPosts(username).then(setPosts)}
              />
            ))
          )}
        </div>
      </div>

      {/* 今日のDDPの積み重ね（タイムライン） */}
      {dailyDdps.length > 0 && (
        <div className="pt-5">
          <div className="card">
            <div className="sec mb-3">⚡過去のシンクロニシティ⚡</div>
            <div className="relative pl-5">
              <div className="absolute bottom-1 left-[5px] top-1 w-[2px] rounded-full" style={{ background: "linear-gradient(180deg,#0abab5,#d4b96a44)" }} />
              {dailyDdps.slice(0, 5).map((d) => {
                const dt = new Date(d.day + "T00:00:00");
                return (
                  <div key={d.day} className="relative pb-4">
                    <div className="absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 border-[#fffdf8]" style={{ background: "#0abab5" }} />
                    <div className="num text-[10.5px] font-bold text-[#0abab5]">
                      {dt.getMonth() + 1}月{dt.getDate()}日
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#4a4438]">{d.body}</div>
                    {pctRow(d)}
                  </div>
                );
              })}
              {dailyDdps.length > 5 && (
                <>
                  {ddpOpen &&
                    dailyDdps.slice(5).map((d) => {
                      const dt = new Date(d.day + "T00:00:00");
                      return (
                        <div key={d.day} className="relative pb-4">
                          <div className="absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 border-[#fffdf8]" style={{ background: "#9cc8c4" }} />
                          <div className="num text-[10.5px] font-bold text-[#8ab4b0]">
                            {dt.getMonth() + 1}月{dt.getDate()}日
                          </div>
                          <div className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[#5a5448]">{d.body}</div>
                          {pctRow(d)}
                        </div>
                      );
                    })}
                  <button onClick={() => setDdpOpen(!ddpOpen)} className="relative -left-1 text-[11.5px] font-bold text-[#0abab5] underline">
                    {ddpOpen ? "たたむ" : "さらに " + String(dailyDdps.length - 5) + "日ぶんをたどる"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* アイディア一覧（本人にだけ見える） */}
      {ideas.length > 0 && (
        <div className="pt-5" id="ideas-sec" style={{ scrollMarginTop: 20 }}>
          <div className="card">
            <div className="sec mb-3 flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/mode-idea.webp" alt="" className="h-[22px] w-[22px] rounded-md object-contain" />
              <span>アイディアメモ</span>
            </div>
            <div className="space-y-2">
              {(ideasOpen ? ideas : ideas.slice(0, 5)).map((i) => {
                const dt = new Date(i.created_at);
                return (
                  <div key={i.id} className="rounded-xl border border-[#ece4f4] bg-[#fbfaff] px-3 py-2">
                    <div className="num text-[10px] font-bold text-[#8a5aff]">
                      {dt.getMonth() + 1}月{dt.getDate()}日
                    </div>
                    <div className="mt-0.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#4a4438]">{i.body}</div>
                  </div>
                );
              })}
            </div>
            {ideas.length > 5 && (
              <button onClick={() => setIdeasOpen(!ideasOpen)} className="mt-2 text-[11.5px] font-bold text-[#8a5aff] underline">
                {ideasOpen ? "たたむ" : `さらに ${ideas.length - 5}件をみる`}
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
