"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, CotozuteProfile, fetchPosts, fetchMyLikes } from "@/lib/cotozute";
import { PostCard } from "@/components/PostCard";

/** むらびとのマイページ — プロフィール + その人の言の葉 */
export default function UserPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const [profile, setProfile] = useState<(CotozuteProfile & { id: string }) | null | undefined>(undefined);
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => setProfile((data as CotozuteProfile & { id: string }) ?? null));
    fetchPosts(username).then(setPosts);
  }, [username]);

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
    <main className="pb-10">
      {/* ヘッダー */}
      <header
        className="px-5 pb-5 pt-4 text-center text-[#e8f0f6]"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <div className="flex items-center justify-between">
          <Link href="/" className="text-[13px] font-bold text-[#d4b96a] no-underline">
            ◀ もどる
          </Link>
          <span className="text-[11px] tracking-widest text-[#7a9ab4]">
            {isMe ? "あなたの名刺" : "むらびとの名刺"}
          </span>
          <span className="w-12" />
        </div>
        <div className="mt-3 flex flex-col items-center">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-20 w-20 rounded-full border-2 border-[#d4b96a]/70 object-cover"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-3xl"
              style={{ background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
            >
              🌿
            </div>
          )}
          <h1 className="mt-2.5 text-xl font-extrabold text-[#f0e6c8]">
            {profile.display_name ?? "むらびと"}
          </h1>
          <div className="text-[11.5px] text-[#7a9ab4]">@{profile.username}</div>
        </div>
      </header>

      {/* 言の葉 */}
      <div className="px-4 pt-4">
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
    </main>
  );
}
