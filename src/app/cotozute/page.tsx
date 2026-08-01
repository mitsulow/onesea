"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchMyLikes } from "@/lib/cotozute";
import { CotozuteComposer } from "@/components/CotozuteComposer";
import { PostCard } from "@/components/PostCard";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute専用ページ — 上から下まで言の葉だけの無限フィード（Xの操作系を移植）。
 * ・下スクロールで20件ずつ自動継ぎ足し（IntersectionObserver）
 * ・30秒ごとに新着を数えて「🌿 新しい言の葉」ピルで追いつき
 * ・右下の浮遊ボタンで投稿シート
 * ・content-visibility で画面外カードの描画コストをゼロに（端末保護）
 */

const PAGE = 20;
const HARD_MAX = 500; // 端末保護の上限（ここまで遡れれば十分）

export default function CotozutePage() {
  const [me, setMe] = useState<User | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [fresh, setFresh] = useState<CotozutePost[]>([]);
  const [composing, setComposing] = useState(false);
  const loadingRef = useRef(false);
  const postsRef = useRef<CotozutePost[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);

  /* 初回ロード */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setAvatar((u?.user_metadata?.avatar_url as string) ?? null);
      if (u) setLikedSet(await fetchMyLikes(u.id));
    });
    fetchPostsPage(0, PAGE).then((list) => {
      setPosts(list);
      postsRef.current = list;
      setHasMore(list.length === PAGE);
    });
  }, []);

  /* 無限スクロール（番兵が見えたら次ページ） */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    const cur = postsRef.current;
    if (cur.length >= HARD_MAX) {
      setHasMore(false);
      return;
    }
    loadingRef.current = true;
    const more = await fetchPostsPage(cur.length, PAGE);
    const seen = new Set(cur.map((p) => p.id));
    const merged = [...cur, ...more.filter((p) => !seen.has(p.id))];
    postsRef.current = merged;
    setPosts(merged);
    setHasMore(more.length === PAGE && merged.length < HARD_MAX);
    loadingRef.current = false;
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" } // 画面の1つ先で先読み
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, posts !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 30秒ごとに新着チェック → 追いつきピル */
  useEffect(() => {
    const t = setInterval(async () => {
      const newest = postsRef.current[0]?.created_at;
      if (!newest) return;
      const latest = await fetchPostsPage(0, PAGE);
      const ids = new Set(postsRef.current.map((p) => p.id));
      setFresh(latest.filter((p) => p.created_at > newest && !ids.has(p.id)));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const catchUp = () => {
    const merged = [...fresh, ...postsRef.current].slice(0, HARD_MAX);
    postsRef.current = merged;
    setPosts(merged);
    setFresh([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = async () => {
    const list = await fetchPostsPage(0, PAGE);
    postsRef.current = list;
    setPosts(list);
    setFresh([]);
    setHasMore(list.length === PAGE);
    setComposing(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="min-h-screen bg-[#fffdf8] pb-20">
      {/* 上部バー（X風: 左アバター・中央ロゴ） */}
      <header className="sticky top-0 z-40 border-b border-[#f0e9dc] bg-[#fffdf8]/92 backdrop-blur-sm">
        <div className="relative flex h-12 items-center justify-center px-4">
          <Link href="/my" aria-label="マイページ" className="absolute left-3 top-1/2 -translate-y-1/2">
            {avatar ? (
              <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0ead9] text-[15px]">🌿</span>
            )}
          </Link>
          <img src="/cotozute-logo.webp" alt="Cotozute" className="h-8 w-auto rounded-lg" />
        </div>
      </header>

      {/* 追いつきピル（Xの「N件のポストを表示」） */}
      {fresh.length > 0 && (
        <div className="pointer-events-none sticky top-[56px] z-40 flex justify-center">
          <button
            onClick={catchUp}
            className="pointer-events-auto rounded-full px-4 py-2 text-[12.5px] font-extrabold text-white shadow-lg"
            style={{ background: "#c94d3a" }}
          >
            🌿 新しい言の葉 {fresh.length}件を表示
          </button>
        </div>
      )}

      {/* フィード本体 */}
      <div className="px-4">
        {posts === null ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#c94d3a] border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#b8b0a0]">
            まだ言の葉がありません。最初のひとことをどうぞ 🌿
          </p>
        ) : (
          <>
            {posts.map((p) => (
              <div key={p.id} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 120px" }}>
                <PostCard post={p} me={me} liked={likedSet.has(p.id)} onDeleted={reload} />
              </div>
            ))}
            <div ref={sentinelRef} />
            {hasMore ? (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e0d5c0] border-t-transparent" />
              </div>
            ) : (
              <p className="py-8 text-center text-[11px] tracking-[2px] text-[#c8c0b0]">
                〜 言の葉は、海へ還りました 🌊 〜
              </p>
            )}
          </>
        )}
      </div>

      {/* 右下の浮遊投稿ボタン（X風） */}
      {me && !composing && (
        <button
          onClick={() => setComposing(true)}
          aria-label="言の葉を投稿"
          className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-[22px] text-white shadow-xl active:scale-95"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 70px)",
            background: "linear-gradient(135deg,#d4603a,#c94d3a)",
          }}
        >
          ✏️
        </button>
      )}

      {/* 投稿シート */}
      {composing && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45" onClick={() => setComposing(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-[#fffdf8] px-4 pb-6 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e0d5c0]" />
            <CotozuteComposer onPosted={reload} />
          </div>
        </div>
      )}
    </main>
  );
}
