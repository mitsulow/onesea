"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchMyLikes } from "@/lib/cotozute";
import { CotozuteComposer } from "./CotozuteComposer";
import { PostCard } from "./PostCard";

/**
 * Cotozute — みんなの言の葉。
 * 初期表示は5件（下の手帳が見えるように）。「もっと見る」で10件ずつ展開。
 * データはページ読み込みで、端末保護のため最大100件で打ち止め（無限に貯めない）。
 */

const INITIAL = 5;
const STEP = 10;
const PAGE = 20;
const MAX = 100; // 端末メモリ保護の上限

export function CotozuteFeed() {
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [visible, setVisible] = useState(INITIAL);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [me, setMe] = useState<User | null>(null);

  const reload = useCallback(async () => {
    const list = await fetchPostsPage(0, PAGE);
    setPosts(list);
    setHasMore(list.length === PAGE);
    setVisible(INITIAL);
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

  const showMore = async () => {
    if (!posts || loadingMore) return;
    const next = visible + STEP;
    if (next > posts.length && hasMore && posts.length < MAX) {
      setLoadingMore(true);
      const more = await fetchPostsPage(posts.length, PAGE);
      const merged = [...posts, ...more];
      setPosts(merged);
      setHasMore(more.length === PAGE && merged.length < MAX);
      setLoadingMore(false);
    }
    setVisible(next);
  };

  const shown = posts?.slice(0, visible) ?? [];
  const remaining = posts ? Math.max(0, posts.length - visible) : 0;

  return (
    <section className="card" style={{ background: "linear-gradient(150deg,#fffbf0,#fffdf8)", margin: "0 -16px", borderRadius: 0, borderLeft: "none", borderRight: "none" }}>
      <div className="sec mb-2.5">💭 Cotozute</div>
      <CotozuteComposer onPosted={reload} />
      {posts === null ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-1.5 text-[13px] text-[#b8b0a0]">
          まだ言の葉がありません。最初のひとことをどうぞ 🌿
        </p>
      ) : (
        <>
          {shown.map((p) => (
            <PostCard key={p.id} post={p} me={me} liked={likedSet.has(p.id)} onDeleted={reload} />
          ))}

          {(remaining > 0 || hasMore) && visible < MAX ? (
            <button
              onClick={showMore}
              disabled={loadingMore}
              className="mt-2 w-full rounded-xl border border-[#e8dcc4] bg-white py-2.5 text-[12.5px] font-bold text-[#8a7a5a] disabled:opacity-50"
            >
              {loadingMore ? "読み込み中..." : `もっと見る${remaining > 0 ? `（あと${remaining}件${hasMore ? "+" : ""}）` : ""}`}
            </button>
          ) : visible >= MAX ? (
            <p className="mt-2 py-1 text-center text-[11px] tracking-[2px] text-[#c8c0b0]">
              〜 言の葉は、海へ還りました 🌊 〜
            </p>
          ) : null}

          {visible > INITIAL && (
            <button
              onClick={() => setVisible(INITIAL)}
              className="mt-1.5 w-full py-1.5 text-center text-[11.5px] font-bold text-[#b0a890]"
            >
              ▲ たたむ
            </button>
          )}
        </>
      )}
    </section>
  );
}
