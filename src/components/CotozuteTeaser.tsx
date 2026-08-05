"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchMyLikes } from "@/lib/cotozute";
import { PostCard } from "./PostCard";
import { srcCdn } from "@/lib/images";

/**
 * Cotozuteチラ見せ — 最新3件だけ見せて、本体（/cotozute の無限フィード）へ誘う。
 * ホームとMMMに置く。
 */
export function CotozuteTeaser() {
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
    fetchPostsPage(0, 5).then(setPosts);
  }, []);

  return (
    <section
      className="card"
      style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)", margin: "0 -16px", borderRadius: 0, borderLeft: "none", borderRight: "none" }}
    >
      <Link href="/cotozute" className="no-underline">
        <span
          className="mb-2 inline-flex items-center gap-2 rounded-full px-5 py-2"
          style={{
            background: "linear-gradient(120deg,#14b8a0,#0a8a84)",
            boxShadow: "0 4px 16px rgba(10,186,181,.35)",
          }}
        >
          <span className="relative text-[15px] leading-none text-white">
            ✦<span className="absolute -right-1.5 -top-1 text-[8px]">✦</span>
          </span>
          <span className="text-[18px] font-extrabold tracking-tight text-white">CotoZute</span>
          <span className="text-[17px] font-extrabold text-white">→</span>
        </span>
      </Link>
      {/* 入力ボックス（タップでコトヅテの投稿画面へ） */}
      <Link href="/cotozute?compose=1" className="mb-2 flex items-center gap-2.5 no-underline">
        {me?.user_metadata?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={srcCdn(me.user_metadata.avatar_url as string)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ead9] text-[16px]">🌿</span>
        )}
        <span className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14px] text-[#8a8d91]">
          幸せの波紋を拡げよう
        </span>
      </Link>
      {posts === null ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">まだ言の葉がありません 🌿</p>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} onDeleted={() => fetchPostsPage(0, 5).then(setPosts)} />
        ))
      )}
      <Link
        href="/cotozute"
        className="mt-2.5 block w-full rounded-xl py-2.5 text-center text-[13px] font-extrabold text-white no-underline shadow-sm"
        style={{ background: "linear-gradient(135deg,#d4603a,#c94d3a)" }}
      >
        続きを見る →
      </Link>
    </section>
  );
}
