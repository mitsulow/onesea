"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchMyLikes } from "@/lib/cotozute";
import { FeedItem, feedKey, fetchMixedFeed } from "@/lib/feed";
import { CotozuteComposer } from "@/components/CotozuteComposer";
import { PostCard } from "@/components/PostCard";
import { MuraFeedCard, ShopFeedCard } from "@/components/FeedCards";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute統合フィード — 3つの媒体がひとつの無限スクロールに混ざる。
 * ① 言の葉（素の行）② ⛺むらびとたより（緑枠・五角形アイコン）③ 🏮楽市楽座（朱枠・商品カード）
 * X流: 固定ヘッダー+タブ / カーソル無限スクロール / 窓方式でメモリ一定 / 追いつきピル / 引っ張って更新
 */

const PAGE = 20;
const WINDOW_MAX = 240;
const TRIM = 80;

export default function CotozutePage() {
  const [me, setMe] = useState<User | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [fresh, setFresh] = useState<FeedItem[]>([]);
  const [composing, setComposing] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<any[]>([]); // ストーリー風の横スクロールイベント
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const itemsRef = useRef<FeedItem[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const fetchHead = useCallback(async (): Promise<FeedItem[]> => {
    return fetchMixedFeed(null, PAGE);
  }, []);

  /* 初回ロード */
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setMyAvatar((u?.user_metadata?.avatar_url as string) ?? null);
      if (u) {
        setLikedSet(await fetchMyLikes(u.id));
        const { data: prof } = await supabase.from("profiles").select("avatar_url").eq("id", u.id).maybeSingle();
        if (prof?.avatar_url) setMyAvatar(prof.avatar_url);
      }
    });
    fetchMixedFeed(null, PAGE).then((list) => {
      setItems(list);
      itemsRef.current = list;
      setHasMore(list.length > 0);
    });
    // ストーリー風イベント（これからの分）
    supabase
      .from("village_posts")
      .select(
        "id, body, photo_url, event_at, villages!village_posts_village_id_fkey(id, name, prefecture)"
      )
      .eq("kind", "event")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true })
      .limit(12)
      .then(({ data }) => setEvents(data ?? []));
    if (new URLSearchParams(window.location.search).get("compose")) setComposing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 無限スクロール（カーソル式・窓方式） */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    const cur = itemsRef.current;
    if (cur.length === 0) return;
    loadingRef.current = true;
    const cursor = cur[cur.length - 1].at;
    const more = await fetchMixedFeed(cursor, PAGE);
    const seen = new Set(cur.map(feedKey));
    let merged = [...cur, ...more.filter((it) => !seen.has(feedKey(it)))];

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

    itemsRef.current = merged;
    setItems(merged);
    setHasMore(more.length > 0);
    loadingRef.current = false;
  }, [hasMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, items !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  /* 新着チェック → 追いつきピル */
  useEffect(() => {
    const check = async () => {
      const newest = itemsRef.current[0]?.at;
      if (!newest) return;
      const latest = await fetchHead();
      const ids = new Set(itemsRef.current.map(feedKey));
      setFresh(latest.filter((it) => it.at > newest && !ids.has(feedKey(it))));
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
  }, [fetchHead]);

  const catchUp = () => {
    const merged = [...fresh, ...itemsRef.current].slice(0, WINDOW_MAX);
    itemsRef.current = merged;
    setItems(merged);
    setFresh([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = async () => {
    const list = await fetchHead();
    itemsRef.current = list;
    setItems(list);
    setFresh([]);
    setHasMore(list.length > 0);
    setComposing(false);
    window.scrollTo({ top: 0 });
  };

  /* 引っ張って更新 */
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
        await reload();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pull, refreshing]);

  return (
    <main className="min-h-screen bg-[#fffdf8] pb-20">
      {/* 上部バー（固定・X風・テキストブランド） */}
      <header className="sticky top-0 z-40 border-b border-[#f0e9dc] bg-[#fffdf8]/95 backdrop-blur-sm">
        <div className="relative flex h-12 flex-col items-center justify-center px-4">
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <AvatarMenu ring="#c8beac" />
          </span>
          <div className="text-[8.5px] font-bold tracking-[3px] text-[#b8b0a0]">幸せを切り取ろう</div>
          <div
            className="text-[17px] font-extrabold leading-tight tracking-[1px]"
            style={{
              background: "linear-gradient(120deg,#14b8a0,#0a8a84)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Cotozute
          </div>
        </div>
      </header>

      {/* 📅 イベント（インスタのストーリー風・横スクロール） */}
      {(events.length > 0 || me) && (
        <div className="border-b border-[#f0e9dc] bg-[#fffdf8] py-2">
          <div className="hide-scrollbar flex gap-3 overflow-x-auto px-3">
            {/* 先頭: 自分の丸+＋ = イベントを作る（インスタの「ストーリーズを追加」と同じ記号） */}
            {me && (
              <a href="/sekai?write=event" className="w-[72px] flex-shrink-0 no-underline">
                <div className="relative mx-auto h-[64px] w-[64px]">
                  <div
                    className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
                    style={{ border: "2.5px solid #e0d8c8", padding: 2, background: "#fff" }}
                  >
                    {myAvatar ? (
                      <img src={myAvatar} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#f0ead9] text-[20px]">✏️</span>
                    )}
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                    style={{ background: "#4a9a5a", border: "2px solid #fffdf8" }}
                  >
                    ＋
                  </span>
                </div>
                <div className="mt-1 text-center text-[9.5px] font-bold leading-tight text-[#8a8070]">イベント作成</div>
              </a>
            )}
            {events.map((ev) => {
              const d = new Date(ev.event_at);
              const title = String(ev.body ?? "").split("\n")[0];
              return (
                <a
                  key={ev.id}
                  href={ev.villages ? `/sekai/village/${ev.villages.id}` : "/sekai"}
                  className="w-[72px] flex-shrink-0 no-underline"
                >
                  <div
                    className="mx-auto flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-full"
                    style={{ border: "2.5px solid #4a9a5a", padding: 2, background: "#fff" }}
                  >
                    {ev.photo_url ? (
                      <img src={ev.photo_url} alt="" loading="lazy" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#eaf4ec] text-[20px]">📅</span>
                    )}
                  </div>
                  <div className="num mt-1 text-center text-[10.5px] font-extrabold leading-none text-[#2a7a48]">
                    {d.getMonth() + 1}/{d.getDate()}
                  </div>
                  <div className="mt-0.5 truncate text-center text-[9.5px] leading-tight text-[#8a8070]">{title}</div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* 追いつきピル */}
      {fresh.length > 0 && (
        <div
          className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2"
          style={{ top: "calc(env(safe-area-inset-top) + 62px)" }}
        >
          <button
            onClick={catchUp}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full py-2 pl-3 pr-4 text-[13px] font-extrabold text-white shadow-xl active:scale-95"
            style={{ background: "linear-gradient(135deg,#d4603a,#c94d3a)" }}
          >
            ↑ 新しいたより +{fresh.length}件
          </button>
        </div>
      )}

      {/* 引っ張って更新のスピナー */}
      {(pull > 0 || refreshing) && (
        <div className="flex items-center justify-center overflow-hidden transition-[height]" style={{ height: refreshing ? 48 : pull }}>
          <div
            className={`h-6 w-6 rounded-full border-2 border-[#c94d3a] border-t-transparent ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? {} : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 55) }}
          />
        </div>
      )}

      {/* フィード本体（3媒体ミックス・区切り線は画面端まで） */}
      <div ref={feedRef}>
        {items === null ? (
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 border-b border-[#f2ece0] px-4 py-3">
                <div className="h-[38px] w-[38px] animate-pulse rounded-full bg-[#efe8d8]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[#efe8d8]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-[#f4efe2]" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[#f4efe2]" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#b8b0a0]">
まだ言の葉がありません。最初のひとことをどうぞ 🌿
          </p>
        ) : (
          <>
            {items.map((it) => (
              <div
                key={feedKey(it)}
                className={it.kind === "coto" ? "border-b border-[#f0e9dc] px-4" : "px-3"}
                style={{ contentVisibility: "auto", containIntrinsicSize: "auto 120px" }}
              >
                {it.kind === "coto" ? (
                  <PostCard post={it.post} me={me} liked={likedSet.has(it.post.id)} onDeleted={reload} flush />
                ) : it.kind === "mura" ? (
                  <MuraFeedCard mura={it.mura} />
                ) : (
                  <ShopFeedCard shop={it.shop} />
                )}
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

      {/* 右下の浮遊投稿ボタン */}
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

      {/* 投稿画面（X風の全画面） */}
      {composing && (
        <div className="fixed inset-0 z-[80] flex justify-center bg-black/30">
          <div
            ref={(el) => {
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
