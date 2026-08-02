"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { CotozutePost, fetchPostsPage, fetchPostsBefore, fetchMyLikes } from "@/lib/cotozute";
import { CotozuteComposer } from "@/components/CotozuteComposer";
import { PostCard } from "@/components/PostCard";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute専用ページ — 上から下まで言の葉だけの無限フィード（Xの操作系を移植）。
 * ・下スクロールで20件ずつ自動継ぎ足し（IntersectionObserver）
 * ・30秒ごとに新着を数えて「🌿 新しい言の葉」ピルで追いつき
 * ・右下の浮遊ボタンで投稿シート
 * ・content-visibility で画面外カードの描画コストをゼロに（端末保護）
 */

const PAGE = 20;
const WINDOW_MAX = 240; // これを超えたら上から捨てる（X方式: だから無限に潜れる）
const TRIM = 80; // 一度に上から捨てる件数

export default function CotozutePage() {
  const [me, setMe] = useState<User | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [posts, setPosts] = useState<CotozutePost[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [fresh, setFresh] = useState<CotozutePost[]>([]);
  const [composing, setComposing] = useState(false);
  const [pull, setPull] = useState(0); // 引っ張って更新の距離
  const [refreshing, setRefreshing] = useState(false);
  const [hideBar, setHideBar] = useState(false); // 下スクロールでヘッダーを隠す（X風）
  const lastY = useRef(0);
  const loadingRef = useRef(false);
  const postsRef = useRef<CotozutePost[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

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

  /* 無限スクロール（番兵が見えたら次ページ・上限なし） */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    const cur = postsRef.current;
    if (cur.length === 0) return;
    loadingRef.current = true;
    // カーソル式: 新着が割り込んでも続きがズレない
    const more = await fetchPostsBefore(cur[cur.length - 1].created_at, PAGE);
    const seen = new Set(cur.map((p) => p.id));
    let merged = [...cur, ...more.filter((p) => !seen.has(p.id))];

    // X方式の窓: 一定を超えたら「上から」捨ててメモリ一定 → 無限に潜れる。
    // 捨てたぶん文書が縮むので、スクロール位置を同じ量だけ引いて画面を静止させる
    if (merged.length > WINDOW_MAX) {
      const feed = feedRef.current;
      const before = feed?.offsetHeight ?? 0;
      merged = merged.slice(TRIM);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const after = feed?.offsetHeight ?? 0;
          if (before > after) window.scrollBy(0, after - before);
        })
      );
    }

    postsRef.current = merged;
    setPosts(merged);
    setHasMore(more.length === PAGE);
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

  /* 新着チェック → 追いつきピル（30秒ごと + アプリに戻ってきた瞬間） */
  useEffect(() => {
    const check = async () => {
      const newest = postsRef.current[0]?.created_at;
      if (!newest) return;
      const latest = await fetchPostsPage(0, PAGE);
      const ids = new Set(postsRef.current.map((p) => p.id));
      setFresh(latest.filter((p) => p.created_at > newest && !ids.has(p.id)));
    };
    const t = setInterval(check, 30000);
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  const catchUp = () => {
    const merged = [...fresh, ...postsRef.current].slice(0, WINDOW_MAX);
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

  /* ヘッダーの隠し・出し（下へ読み進むと消え、少しでも上に戻すと現れる） */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 60) setHideBar(false);
      else if (y > lastY.current + 6) setHideBar(true);
      else if (y < lastY.current - 6) setHideBar(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* 引っ張って更新（X風。ページ最上部で下に引くとスピナー→更新） */
  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) touchStartY.current = e.touches[0].clientY;
      else touchStartY.current = null;
    };
    const onMove = (e: TouchEvent) => {
      if (touchStartY.current == null || refreshing) return;
      const dy = e.touches[0].clientY - touchStartY.current;
      if (dy > 0 && window.scrollY <= 0) setPull(Math.min(90, dy * 0.6));
    };
    const onEnd = async () => {
      if (touchStartY.current == null) return;
      touchStartY.current = null;
      if (pull > 48 && !refreshing) {
        setRefreshing(true);
        setPull(48);
        const list = await fetchPostsPage(0, PAGE);
        postsRef.current = list;
        setPosts(list);
        setFresh([]);
        setHasMore(list.length === PAGE);
        setRefreshing(false);
      }
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, refreshing]);

  return (
    <main className="min-h-screen bg-[#fffdf8] pb-20">
      {/* 上部バー（X風: 左アバター・中央ロゴ） */}
      <header
        className="sticky top-0 z-40 border-b border-[#f0e9dc] bg-[#fffdf8]/92 backdrop-blur-sm transition-transform duration-200"
        style={{ transform: hideBar ? "translateY(-110%)" : "none" }}
      >
        <div className="relative flex h-12 items-center justify-center px-4">
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <AvatarMenu ring="#c8beac" />
          </span>
          <img src="/cotozute-logo.webp" alt="Cotozute" className="h-8 w-auto rounded-lg" />
        </div>
      </header>

      {/* 追いつきピル（Xの「新しいポストを表示」— スクロール中でも常に画面上部に浮かぶ） */}
      {fresh.length > 0 && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2 transition-all duration-200"
          style={{ top: hideBar ? "calc(env(safe-area-inset-top) + 10px)" : "calc(env(safe-area-inset-top) + 58px)" }}
        >
          <button
            onClick={catchUp}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full py-2 pl-3 pr-4 text-[13px] font-extrabold text-white shadow-xl active:scale-95"
            style={{ background: "linear-gradient(135deg,#d4603a,#c94d3a)" }}
          >
            ↑ 新しい言の葉 +{fresh.length}件
          </button>
        </div>
      )}

      {/* 引っ張って更新のスピナー */}
      {(pull > 0 || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-[height]"
          style={{ height: refreshing ? 48 : pull }}
        >
          <div
            className={`h-6 w-6 rounded-full border-2 border-[#c94d3a] border-t-transparent ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? {} : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 55) }}
          />
        </div>
      )}

      {/* フィード本体 */}
      <div className="px-4" ref={feedRef}>
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
            {hasMore && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e0d5c0] border-t-transparent" />
              </div>
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

      {/* 投稿画面（X風の全画面・開いた瞬間に書ける） */}
      {composing && (
        <div className="fixed inset-0 z-[80] flex justify-center bg-black/30">
          <div
            ref={(el) => {
              // 開いた瞬間にキーボードを出す（X同様）
              if (el) setTimeout(() => el.querySelector("textarea")?.focus(), 60);
            }}
            className="h-full w-full max-w-[480px] overflow-y-auto bg-[#fffdf8]"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <button onClick={() => setComposing(false)} className="py-1 pr-3 text-[14px] text-[#8a8070]">
                キャンセル
              </button>
              <span className="text-[13px] font-bold tracking-[2px] text-[#a09888]">言の葉</span>
              <span className="w-14" />
            </div>
            <div className="px-4">
              <CotozuteComposer onPosted={reload} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
