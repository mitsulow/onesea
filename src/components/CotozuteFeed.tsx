"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPosts, fetchMyLikes } from "@/lib/cotozute";
import { CotozuteComposer } from "./CotozuteComposer";
import { PostCard } from "./PostCard";

/** Cotozute — みんなの言の葉（楽市楽座「情緒」と同じ操作系・Onesea 専用DB） */
export function CotozuteFeed() {
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);

  const reload = useCallback(async () => {
    const list = await fetchPosts();
    setPosts(list);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
    reload();
  }, [reload]);

  return (
    <section className="card" style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)" }}>
      <div className="sec mb-2.5">
        💭 Cotozute{" "}
        <span className="font-normal tracking-normal text-[#c0b8a8]">みんなの言の葉</span>
      </div>
      <CotozuteComposer onPosted={reload} />
      {posts === null ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">
          まだ言の葉がありません。最初のひとことをどうぞ 🌿
        </p>
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} onDeleted={reload} />
        ))
      )}
    </section>
  );
}
