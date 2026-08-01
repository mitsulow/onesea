"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchMyLikes } from "@/lib/cotozute";
import { PostCard } from "./PostCard";

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
    fetchPostsPage(0, 3).then(setPosts);
  }, []);

  return (
    <section
      className="card"
      style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)", margin: "0 -16px", borderRadius: 0, borderLeft: "none", borderRight: "none" }}
    >
      <Link href="/cotozute" className="no-underline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cotozute-logo.webp" alt="Cotozute" className="mb-2 h-10 w-auto rounded-xl" />
      </Link>
      {posts === null ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">まだ言の葉がありません 🌿</p>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} onDeleted={() => fetchPostsPage(0, 3).then(setPosts)} />
        ))
      )}
      <Link
        href="/cotozute"
        className="mt-2.5 block w-full rounded-xl py-2.5 text-center text-[13px] font-extrabold text-white no-underline shadow-sm"
        style={{ background: "linear-gradient(135deg,#d4603a,#c94d3a)" }}
      >
        🌿 すべての言の葉へ →
      </Link>
    </section>
  );
}
