"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPosts, fetchMyLikes } from "@/lib/cotozute";
import { getOrCreateChat } from "@/lib/line";
import { uploadImage } from "@/lib/images";
import { Shop, fetchShopsByOwner, categoryOf } from "@/lib/za";
import { SnsIcon } from "@/components/SnsIcon";
import { PostCard } from "@/components/PostCard";

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
  const [shops, setShops] = useState<Shop[]>([]);
  const [masterDdp, setMasterDdp] = useState<string | null>(null);
  const [dailyDdps, setDailyDdps] = useState<Array<{ day: string; body: string }>>([]);
  const [ddpOpen, setDdpOpen] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const loadProfile = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, cover_url, bio, status_line, prefecture, city, rice_work, life_work, skills, wants_to_do, sns")
      .eq("username", username)
      .maybeSingle();
    const prof = (data as FullProfile) ?? null;
    setProfile(prof);
    if (prof) {
      fetchShopsByOwner(prof.id).then(setShops);
      supabase.from("ddp").select("body").eq("user_id", prof.id).maybeSingle().then(({ data: d }) => setMasterDdp(d?.body ?? null));
      supabase
        .from("daily_ddp")
        .select("day, body")
        .eq("user_id", prof.id)
        .order("day", { ascending: false })
        .limit(120)
        .then(({ data: dd }) => setDailyDdps((dd as Array<{ day: string; body: string }>) ?? []));
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

  const changeImage = async (kind: "cover" | "avatar", file: File | null) => {
    if (!me || !file || busy) return;
    setBusy(kind);
    const url = await uploadImage("avatars", me.id, file, kind === "cover" ? 1600 : 512, 0.82);
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

  return (
    <main className="pb-20">
      {/* カバー画像 */}
      <div className="relative h-44 w-full overflow-hidden">
        {profile.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.cover_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "linear-gradient(160deg,#0e1e2e 0%,#17384e 60%,#1e4a66 100%)" }}
          />
        )}
        <Link
          href="/"
          className="absolute left-3 top-3 rounded-full bg-black/40 px-3 py-1.5 text-[12px] font-bold text-white no-underline backdrop-blur-sm"
        >
          ◀ もどる
        </Link>
        {isMe && (
          <>
            <button
              onClick={() => coverInput.current?.click()}
              className="absolute bottom-2.5 right-3 rounded-full bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm"
            >
              {busy === "cover" ? "⏳" : "📷 背景を変える"}
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
              src={profile.avatar_url}
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
                {busy === "avatar" ? "⏳" : "📷"}
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
          <h1 className="text-[21px] font-extrabold leading-snug text-[#3a3428]">
            {profile.display_name ?? "むらびと"}
          </h1>
          <div className="text-[12px] text-[#a09888]">@{profile.username}</div>
          {profile.status_line && (
            <div className="mt-0.5 text-[13px] font-medium text-[#5a5448]">{profile.status_line}</div>
          )}
          {(profile.prefecture || profile.city) && (
            <div className="mt-0.5 text-[12px] text-[#a09888]">
              {"\uD83D\uDCCD"} {profile.prefecture ?? ""}{profile.city ? " " + profile.city : ""}
            </div>
          )}
        </div>

        {/* DDP（端的な夢） */}
        {masterDdp && (
          <div
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
                if (chatId) router.push(`/line/${chatId}`);
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
                <SnsIcon platform={platform} size={17} />
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
            <div className="mb-1 text-[10.5px] font-bold tracking-wider text-[#a09888]">🌱 やりたいこと</div>
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
        <div className="px-4 pt-5">
          <div className="card">
            <div className="sec mb-2.5 flex items-center gap-1.5"><img src="/rakuichi/logo-emblem.webp" alt="" className="inline-block h-[18px] w-[18px] rounded-full object-cover align-[-3px]" /><span>{isMe ? "あなたの楽座" : "この人の楽座"}</span></div>
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
                        {shop.image_urls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={shop.image_urls[0]} alt={shop.name} className="h-full w-full object-cover" />
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
                          {shop.is_trial ? "0円〜" : shop.price_jpy != null ? "¥" + shop.price_jpy.toLocaleString() : ""}
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

      {/* 言の葉 */}
      <div className="px-4 pt-5">
        <div className="card">
          <div className="sec mb-2">💭 {isMe ? "あなたの言の葉" : "この人の言の葉"}</div>
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
        <div className="px-4 pt-5">
          <div className="card">
            <div className="sec mb-3">🌊 {isMe ? "あなたの今日のDDP" : "この人の今日のDDP"}</div>
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
    </main>
  );
}
