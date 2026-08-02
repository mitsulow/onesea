"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchMyLikes } from "@/lib/cotozute";
import { PostCard } from "@/components/PostCard";
import { AvatarMenu } from "@/components/AvatarMenu";

/** 🔍 コトヅテ検索 — 言の葉と人をさがす */
export default function CotozuteSearchPage() {
  const [me, setMe] = useState<User | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CotozutePost[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
  }, []);

  /* 入力が止まって0.4秒後に自動検索 */
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (!query) {
      setResults(null);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("posts")
        .select(
          "id, user_id, body, image_urls, thumb_urls, embed, created_at, profiles!posts_user_id_fkey(username, display_name, avatar_url, member_no), likes(count), comments(count)"
        )
        .ilike("body", `%${query}%`)
        .order("created_at", { ascending: false })
        .limit(30);
      setResults((data as unknown as CotozutePost[]) ?? []);
      setSearching(false);
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <main className="min-h-screen bg-[#fffdf8] pb-20">
      <header className="sticky top-0 z-40 border-b border-[#f0e9dc] bg-[#fffdf8]/95 backdrop-blur-sm">
        <div className="relative flex h-12 items-center px-4">
          <div className="mr-12 flex flex-1 items-center gap-2 rounded-xl bg-[#f0ead9] px-3 py-1.5">
            <span className="text-[13px] text-[#a09888]">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="言の葉をさがす"
              autoFocus
              className="w-full bg-transparent text-[14px] text-[#3a3428] outline-none placeholder:text-[#b8b0a0]"
            />
            {q && (
              <button onClick={() => setQ("")} className="text-[12px] text-[#b8b0a0]">
                ×
              </button>
            )}
          </div>
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <AvatarMenu ring="#c8beac" />
          </span>
        </div>
      </header>

      <div className="px-4">
        {results === null ? (
          <p className="py-12 text-center text-[12.5px] leading-relaxed text-[#b8b0a0]">
            ことば・名前・話題で検索できます 🌿
          </p>
        ) : searching ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : results.length === 0 ? (
          <p className="py-12 text-center text-[12.5px] text-[#b8b0a0]">「{q}」の言の葉は見つかりませんでした</p>
        ) : (
          results.map((p) => <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} />)
        )}
      </div>
    </main>
  );
}
