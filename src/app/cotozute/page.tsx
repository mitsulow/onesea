"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchMyLikes } from "@/lib/cotozute";
import { FeedItem, feedKey, fetchMixedFeed, fetchLatestShops, fetchLikersFor } from "@/lib/feed";
import type { Shop } from "@/lib/za";
import { CotozuteComposer } from "@/components/CotozuteComposer";
import { PostCard } from "@/components/PostCard";
import { MuraFeedCard, ShopStripCard } from "@/components/FeedCards";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element */

/**
 * Cotozute — Facebook型のホームフィード。
 * ☰+CotoZuteヘッダー → 投稿ボックス（幸せの波紋を拡げよう）→ ストーリー（イベント）
 * → 無限フィード（言の葉+むらびとたより混在、途中にイベント/楽市楽座の横スクロール）。
 * 区切りはFBと同じ「太いグレー帯」。
 */

const PAGE = 20;
const WINDOW_MAX = 240;
const TRIM = 80;
const TIFFANY = "#0abab5";

type Liker = { avatar_url: string | null; display_name: string | null };

const MENU_ITEMS: Array<{ href: string; icon: string; label: string; ext?: boolean }> = [
  { href: "/mmm", icon: "/icons/cel-sun.png", label: "MasterMindMembers" },
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
  { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
  { href: "/cotozute", icon: "/icons/tab-cotozute.png", label: "コトヅテ" },
  { href: "/", icon: "/icons/tab-home.png", label: "ホーム" },
  { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
  { href: "/#techo", icon: "📖", label: "手帳", ext: true },
  { href: "/my", icon: "🪪", label: "マイページ" },
  { href: "/line", icon: "💬", label: "TALK" },
];

/** FB風の太いグレー帯（左右いっぱい） */
function Band() {
  return <div className="-mx-4 h-2 bg-[#e9ebee]" />;
}

export default function CotozutePage() {
  const [me, setMe] = useState<User | null>(null);
  const [myAvatar, setMyAvatar] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [likersMap, setLikersMap] = useState<Record<string, Liker[]>>({});
  const [hasMore, setHasMore] = useState(true);
  const [fresh, setFresh] = useState<FeedItem[]>([]);
  const [composing, setComposing] = useState(false);
  const [events, setEvents] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [shops, setShops] = useState<Shop[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const loadingRef = useRef(false);
  const itemsRef = useRef<FeedItem[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number | null>(null);

  const loadLikers = useCallback(async (list: FeedItem[]) => {
    const ids = list.filter((x) => x.kind === "coto").map((x) => (x.kind === "coto" ? x.post.id : ""));
    if (!ids.length) return;
    const map = await fetchLikersFor(ids);
    setLikersMap((prev) => ({ ...prev, ...map }));
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
      loadLikers(list);
    });
    fetchLatestShops(10).then(setShops);
    supabase
      .from("village_posts")
      .select("id, body, photo_url, event_at, villages!village_posts_village_id_fkey(id, name, prefecture)")
      .eq("kind", "event")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true })
      .limit(12)
      .then(({ data }) => setEvents(data ?? []));
    if (new URLSearchParams(window.location.search).get("compose")) setComposing(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 無限スクロール */
  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    const cur = itemsRef.current;
    if (cur.length === 0) return;
    loadingRef.current = true;
    const more = await fetchMixedFeed(cur[cur.length - 1].at, PAGE);
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
    loadLikers(more);
    loadingRef.current = false;
  }, [hasMore, loadLikers]);

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

  /* 新着チェック */
  useEffect(() => {
    const check = async () => {
      const newest = itemsRef.current[0]?.at;
      if (!newest) return;
      const latest = await fetchMixedFeed(null, PAGE);
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
  }, []);

  const catchUp = () => {
    const merged = [...fresh, ...itemsRef.current].slice(0, WINDOW_MAX);
    itemsRef.current = merged;
    setItems(merged);
    setFresh([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reload = async () => {
    const list = await fetchMixedFeed(null, PAGE);
    itemsRef.current = list;
    setItems(list);
    setFresh([]);
    setHasMore(list.length > 0);
    setComposing(false);
    loadLikers(list);
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

  /* イベントストーリー（FB型の縦カード） */
  const stories = events.length > 0 && (
    <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2.5">
      {events.map((ev) => {
        const d = new Date(ev.event_at);
        const title = String(ev.body ?? "").split("\n")[0];
        return (
          <a
            key={ev.id}
            href={ev.villages ? `/sekai/village/${ev.villages.id}` : "/sekai"}
            className="relative h-[168px] w-[106px] flex-shrink-0 overflow-hidden rounded-xl border border-[#e4e6e9] no-underline"
          >
            {ev.photo_url ? (
              <img src={ev.photo_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0" style={{ background: "linear-gradient(160deg,#4a9a5a,#1e4530)" }} />
            )}
            <span className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,.05) 40%,rgba(0,0,0,.55))" }} />
            <span
              className="num absolute left-0 right-0 top-[38%] text-center text-[21px] font-extrabold text-white"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,.6)", lineHeight: 1 }}
            >
              {d.getMonth() + 1}/{d.getDate()}
            </span>
            <span className="absolute bottom-1.5 left-1.5 right-1.5 line-clamp-2 text-[10px] font-bold leading-snug text-white">
              {title}
            </span>
          </a>
        );
      })}
    </div>
  );

  /* 楽市楽座 横スクロール */
  const shopStrip = shops.length > 0 && (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1c1e21]">
          <img src="/rakuichi/logo-emblem.webp" alt="" className="h-[18px] w-[18px] rounded-full object-cover" />
          楽市楽座
        </span>
        <Link href="/za" className="text-[12px] font-bold no-underline" style={{ color: TIFFANY }}>
          すべて見る
        </Link>
      </div>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {shops.map((sh) => (
          <ShopStripCard key={sh.id} shop={sh} />
        ))}
      </div>
    </div>
  );

  /* イベント横スクロール（中盤・リール位置） */
  const eventStrip = events.length > 0 && (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span className="text-[13.5px] font-bold text-[#1c1e21]">📅 イベント</span>
        <Link href="/sekai" className="text-[12px] font-bold no-underline" style={{ color: TIFFANY }}>
          すべて見る
        </Link>
      </div>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {events.map((ev) => {
          const d = new Date(ev.event_at);
          const title = String(ev.body ?? "").split("\n")[0];
          return (
            <a
              key={ev.id}
              href={ev.villages ? `/sekai/village/${ev.villages.id}` : "/sekai"}
              className="w-[170px] flex-shrink-0 overflow-hidden rounded-xl border border-[#e4e6e9] bg-white no-underline shadow-sm"
            >
              <div className="relative h-[96px] bg-[#eaf2ea]">
                {ev.photo_url ? (
                  <img src={ev.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white"
                    style={{ background: "linear-gradient(160deg,#4a9a5a,#1e4530)" }}
                  >
                    ⛺ {ev.villages?.name ?? "セカイムラ"}
                  </div>
                )}
              </div>
              <div className="px-2.5 py-2">
                <div className="num text-[12.5px] font-extrabold text-[#d04030]">
                  {d.getMonth() + 1}月{d.getDate()}日 {d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}〜
                </div>
                <div className="mt-0.5 line-clamp-2 text-[12px] font-bold leading-snug text-[#1c1e21]">{title}</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );

  /* フィード項目 + 中盤ストリップの差し込み */
  const renderItems = () => {
    if (!items) return null;
    const out: React.ReactNode[] = [];
    items.forEach((it, i) => {
      out.push(
        <div key={feedKey(it)} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 160px" }}>
          {it.kind === "coto" ? (
            <PostCard
              post={it.post}
              me={me}
              liked={likedSet.has(it.post.id)}
              onDeleted={reload}
              likers={likersMap[it.post.id]}
            />
          ) : it.kind === "mura" ? (
            <MuraFeedCard mura={it.mura} />
          ) : null}
        </div>
      );
      out.push(<Band key={`b-${feedKey(it)}`} />);
      if (i === 2 && eventStrip) {
        out.push(<div key="ev-strip">{eventStrip}</div>);
        out.push(<Band key="ev-band" />);
      }
      if (i === 7 && shopStrip) {
        out.push(<div key="shop-strip">{shopStrip}</div>);
        out.push(<Band key="shop-band" />);
      }
    });
    return out;
  };

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* ヘッダー: ☰ + CotoZute（ティファニーブルー） */}
      <header className="sticky top-0 z-40 bg-white/97 backdrop-blur-sm">
        <div className="flex h-12 items-center gap-3 px-4">
          <button onClick={() => setDrawer(true)} aria-label="メニュー" className="text-[22px] leading-none text-[#1c1e21]">
            ☰
          </button>
          <span className="text-[22px] font-extrabold tracking-tight" style={{ color: TIFFANY }}>
            CotoZute
          </span>
          <span className="ml-auto">
            <AvatarMenu ring="#c8beac" />
          </span>
        </div>
        <div className="h-px bg-[#e4e6e9]" />
      </header>

      {/* ☰メニュー（左ドロワー） */}
      {drawer && (
        <>
          <div className="fixed inset-0 z-[85] bg-black/35" onClick={() => setDrawer(false)} />
          <div className="fixed left-0 top-0 z-[86] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
            <div className="px-5 pb-2 pt-5 text-[20px] font-extrabold" style={{ color: TIFFANY }}>
              CotoZute
            </div>
            {MENU_ITEMS.map((m) =>
              m.ext ? (
                <a
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-3 border-b border-[#f2f3f5] px-5 py-3 text-[14px] font-medium text-[#1c1e21] no-underline"
                >
                  {m.icon.startsWith("/") ? (
                    <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  ) : (
                    <span className="w-[22px] text-center text-[17px]">{m.icon}</span>
                  )}
                  {m.label}
                </a>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setDrawer(false)}
                  className="flex items-center gap-3 border-b border-[#f2f3f5] px-5 py-3 text-[14px] font-medium text-[#1c1e21] no-underline"
                >
                  {m.icon.startsWith("/") ? (
                    <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  ) : (
                    <span className="w-[22px] text-center text-[17px]">{m.icon}</span>
                  )}
                  {m.label}
                </Link>
              )
            )}
          </div>
        </>
      )}

      {/* 追いつきピル */}
      {fresh.length > 0 && (
        <div className="pointer-events-none fixed left-1/2 z-50 -translate-x-1/2" style={{ top: "calc(env(safe-area-inset-top) + 60px)" }}>
          <button
            onClick={catchUp}
            className="pointer-events-auto rounded-full py-2 pl-3 pr-4 text-[13px] font-extrabold text-white shadow-xl active:scale-95"
            style={{ background: TIFFANY }}
          >
            ↑ 新しい投稿 +{fresh.length}件
          </button>
        </div>
      )}

      {/* 引っ張って更新 */}
      {(pull > 0 || refreshing) && (
        <div className="flex items-center justify-center overflow-hidden transition-[height]" style={{ height: refreshing ? 48 : pull }}>
          <div
            className={`h-6 w-6 rounded-full border-2 ${refreshing ? "animate-spin" : ""}`}
            style={{
              borderColor: TIFFANY,
              borderTopColor: "transparent",
              ...(refreshing ? {} : { transform: `rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 55) }),
            }}
          />
        </div>
      )}

      <div className="px-4" ref={feedRef}>
        {/* 投稿ボックス（FB型: アバター + 丸ボックス + 写真） */}
        <div className="flex items-center gap-2.5 py-2.5">
          {myAvatar ? (
            <img src={myAvatar} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[16px]">🌿</span>
          )}
          <button
            onClick={() => setComposing(true)}
            className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14.5px] text-[#65676b]"
          >
            幸せの波紋を拡げよう
          </button>
          <button onClick={() => setComposing(true)} aria-label="写真を添付" className="flex-shrink-0 text-[22px]">
            🖼️
          </button>
        </div>

        {/* ストーリー（イベント・FB型縦カード） */}
        {stories}
        <Band />

        {/* フィード */}
        {items === null ? (
          <div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="h-[40px] w-[40px] animate-pulse rounded-full bg-[#eceef1]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[#eceef1]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-[#f2f3f5]" />
                  <div className="h-24 w-full animate-pulse rounded bg-[#f2f3f5]" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-[#8a8d91]">まだ投稿がありません。最初のひとことをどうぞ 🌿</p>
        ) : (
          <>
            {renderItems()}
            <div ref={sentinelRef} />
            {hasMore && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d8dade] border-t-transparent" />
              </div>
            )}
          </>
        )}
      </div>

      {/* 投稿画面（全画面） */}
      {composing && (
        <div className="fixed inset-0 z-[80] flex justify-center bg-black/30">
          <div
            ref={(el) => {
              if (el) setTimeout(() => el.querySelector("textarea")?.focus(), 60);
            }}
            className="h-full w-full max-w-[480px] overflow-y-auto bg-white"
            style={{ paddingTop: "calc(env(safe-area-inset-top) + 4px)" }}
          >
            <div className="flex items-center justify-between px-4 py-2.5">
              <button onClick={() => setComposing(false)} className="py-1 pr-3 text-[14px] text-[#65676b]">
                キャンセル
              </button>
              <span className="text-[14px] font-bold text-[#1c1e21]">投稿を作成</span>
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
