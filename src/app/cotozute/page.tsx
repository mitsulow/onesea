"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchMyLikes } from "@/lib/cotozute";
import { isWarawaUntil } from "@/lib/warawa";
import { FeedItem, Story, feedKey, fetchMixedFeed, fetchLatestShops, fetchLikersFor, fetchStories, addStory, deleteStory } from "@/lib/feed";
import type { Shop } from "@/lib/za";
import { CotozuteComposer } from "@/components/CotozuteComposer";
import { PostCard } from "@/components/PostCard";
import { MuraFeedCard, ShopStripCard } from "@/components/FeedCards";
import { AvatarMenu } from "@/components/AvatarMenu";
import { UpgradeDialog } from "@/components/UpgradeGate";
import { VillagerSuggestions } from "@/components/VillagerSuggestions";
import { srcCdn } from "@/lib/images";

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
// コーポレート水色（OneSea 一番かっこいい水色）。定数名は歴史的経緯で TIFFANY のまま。
const TIFFANY = "#2CB7DE";

type Liker = { avatar_url: string | null; display_name: string | null };

const MENU_ITEMS: Array<{ href: string; icon: string; label: string; ext?: boolean }> = [
  { href: "/mmm", icon: "/icons/cel-sun.png", label: "MasterMindMembers" },
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
  { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
  { href: "/cotozute", icon: "/icons/tab-cotozute.png", label: "コトヅテ" },
  { href: "/", icon: "/icons/tab-home.png", label: "ホーム" },
  { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
  { href: "/#techo", icon: "📖", label: "手帳", ext: true },
  { href: "/my", icon: "🪪", label: "マイページ編集" },
  { href: "/line", icon: "💬", label: "TALK" },
];

/** 投稿の区切り線（細いティファニーブルー・左右いっぱい） */
function Band() {
  return <div className="-mx-4 h-[2.5px]" style={{ background: "rgba(10,186,181,.22)" }} />;
}

/** 横スワイプセクション用の二重線（区切りを強調） */
function BandDouble() {
  return (
    <div className="-mx-4">
      <div className="h-[2.5px]" style={{ background: "rgba(10,186,181,.4)" }} />
      <div className="h-[3px] bg-white" />
      <div className="h-[2.5px]" style={{ background: "rgba(10,186,181,.4)" }} />
    </div>
  );
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
  const [stories, setStoriesList] = useState<Story[]>([]);
  const [storyView, setStoryView] = useState<number | null>(null); // 表示中のストーリーindex
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{ file: File; url: string } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false); // 投稿はわらわ〜会員専用
  const [isWara, setIsWara] = useState(false);
  const [autoLimit, setAutoLimit] = useState(30); // 無限スクロールは30件ごとに一時停止
  const [storyText, setStoryText] = useState("");
  const [storyColor, setStoryColor] = useState("#0affd0");
  const [storyPos, setStoryPos] = useState({ x: 0.5, y: 0.5 }); // 文字位置（自由ドラッグ）
  const [storySize, setStorySize] = useState(30); // 文字サイズ（プレビューpx・ピンチで変更）
  const [storyRot, setStoryRot] = useState(0); // 回転（度・二本指）
  const storyPinch = useRef<{ d0: number; a0: number; size0: number; rot0: number } | null>(null);
  const storyBoxRef = useRef<HTMLDivElement>(null);
  const storySwipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hideBar, setHideBar] = useState(false);
  const lastY = useRef(0);
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
    // フィード最下部に和紙色が覗く/引っぱりで見えるのを防ぐ（このページは白基調）
    const prevBg = document.body.style.background;
    document.body.style.background = "#fff";
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setMyAvatar((u?.user_metadata?.avatar_url as string) ?? null);
      let wara = false;
      if (u) {
        setLikedSet(await fetchMyLikes(u.id));
        const { data: prof } = await supabase
          .from("profiles")
          .select("avatar_url, warawa_until")
          .eq("id", u.id)
          .maybeSingle();
        if (prof?.avatar_url) setMyAvatar(prof.avatar_url);
        wara = isWarawaUntil(prof?.warawa_until as string | null);
        setIsWara(wara);
      }
      // ?compose=1 で来た人: わらわ〜なら作成画面、そうでなければ案内
      if (new URLSearchParams(window.location.search).get("compose")) {
        if (u && wara) setComposing(true);
        else setShowUpgrade(true);
      }
    });
    fetchMixedFeed(null, PAGE).then((list) => {
      setItems(list);
      itemsRef.current = list;
      setHasMore(list.length > 0);
      loadLikers(list);
    });
    fetchLatestShops(10).then(setShops);
    fetchStories().then(setStoriesList);
    supabase
      .from("village_posts")
      .select("id, body, photo_url, event_at, villages!village_posts_village_id_fkey(id, name, prefecture)")
      .eq("kind", "event")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true })
      .limit(12)
      .then(({ data }) => setEvents(data ?? []));
    return () => {
      document.body.style.background = prevBg;
    };
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
        // 30件ごとに一時停止 — 「続きを読み込む」を押すまで自動読み込みしない
        if (entries[0].isIntersecting && itemsRef.current.length < autoLimit) loadMore();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, autoLimit, items !== null]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* 没入: 端末のステータスバー領域まで白に溶かす（FBの秘伝のタレ①） */
  useEffect(() => {
    const prevBg = document.body.style.background;
    document.body.style.background = "#ffffff";
    let meta = document.querySelector('meta[name="theme-color"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    const prevTheme = meta.getAttribute("content");
    meta.setAttribute("content", "#ffffff");
    return () => {
      document.body.style.background = prevBg;
      if (created) meta?.remove();
      else if (meta && prevTheme) meta.setAttribute("content", prevTheme);
    };
  }, []);

  /* ヘッダーの隠し/出し（FBの秘伝のタレ②）:
     下に読み進めると完全に消えて投稿が画面上端まで。
     上に「少しでも」戻すと、あっという間にスッと現れる（上方向は高感度） */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 56) setHideBar(false);
      else if (y > lastY.current + 6) setHideBar(true); // 下: 少し鈍く
      else if (y < lastY.current - 2) setHideBar(false); // 上: 即反応
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  /* ストーリーズ（24時間で消える・写真1枚・FB型） */
  const postStory = (f: File | null) => {
    if (!me || !isWara) {
      setShowUpgrade(true);
      return;
    }
    if (!me || !f || storyUploading) return;
    setStoryText("");
    setStoryPos({ x: 0.5, y: 0.5 });
    setStorySize(30);
    setStoryRot(0);
    setStoryDraft({ file: f, url: URL.createObjectURL(f) });
  };

  /** ネオン文字を写真に焼き込んで投稿（閲覧側はただの画像=軽い） */
  const bakeAndPost = async () => {
    if (!me || !storyDraft || storyUploading) return;
    setStoryUploading(true);
    const img = new Image();
    img.onload = async () => {
      const maxW = 960;
      const sc = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * sc);
      canvas.height = Math.round(img.height * sc);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const text = storyText.trim();
      const box = storyBoxRef.current?.getBoundingClientRect();
      if (text && box) {
        // object-contain のレターボックスを補正して、プレビューと同じ場所・大きさ・角度で焼く
        const fit = Math.min(box.width / img.width, box.height / img.height);
        const dispW = img.width * fit;
        const dispH = img.height * fit;
        const offX = (box.width - dispW) / 2;
        const offY = (box.height - dispH) / 2;
        const xi = Math.min(1, Math.max(0, (storyPos.x * box.width - offX) / dispW));
        const yi = Math.min(1, Math.max(0, (storyPos.y * box.height - offY) / dispH));
        const fs = Math.round(storySize * (canvas.width / dispW));
        const lines = text.split("\n");
        ctx.save();
        ctx.translate(canvas.width * xi, canvas.height * yi);
        ctx.rotate((storyRot * Math.PI) / 180);
        ctx.font = `900 ${fs}px -apple-system, "Hiragino Sans", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const cy0 = -((lines.length - 1) * fs * 1.25) / 2;
        lines.forEach((line, i) => {
          const y = cy0 + i * fs * 1.25;
          ctx.shadowColor = storyColor;
          ctx.shadowBlur = fs * 0.55;
          ctx.fillStyle = storyColor;
          ctx.fillText(line, 0, y);
          ctx.fillText(line, 0, y);
          ctx.shadowBlur = fs * 0.18;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(line, 0, y);
        });
        ctx.restore();
      }
      canvas.toBlob(
        async (blob) => {
          if (blob) {
            const { uploadCroppedBlob } = await import("@/lib/images");
            const url = await uploadCroppedBlob("post-images", me.id, blob);
            if (url) {
              await addStory(me.id, url);
              setStoriesList(await fetchStories());
            }
          }
          URL.revokeObjectURL(storyDraft.url);
          setStoryDraft(null);
          setStoryUploading(false);
        },
        "image/webp",
        0.72
      );
    };
    img.src = storyDraft.url;
  };

  const storiesRow = (
    <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2.5">
      {/* 一番左: ストーリーズを作成 */}
      {me && (
        <label className="relative h-[168px] w-[106px] flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[#e4e6e9] bg-white">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => postStory(e.target.files?.[0] ?? null)} />
          <div className="h-[104px] w-full bg-[#f0f2f5]">
            {myAvatar ? (
              <img src={srcCdn(myAvatar)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[28px]">🌿</div>
            )}
          </div>
          <span
            className="absolute left-1/2 top-[104px] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-[18px] font-extrabold text-white"
            style={{ background: TIFFANY }}
          >
            ＋
          </span>
          <div className="px-1 pt-5 text-center text-[10.5px] font-bold leading-snug text-[#1c1e21]">
            {storyUploading ? "投稿中..." : "ストーリーズを作成"}
          </div>
        </label>
      )}
      {stories.map((st, i) => (
        <button
          key={st.id}
          onClick={() => setStoryView(i)}
          className="relative h-[168px] w-[106px] flex-shrink-0 overflow-hidden rounded-xl border border-[#e4e6e9]"
        >
          <img src={srcCdn(st.image_url)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(0,0,0,.02) 55%,rgba(0,0,0,.5))" }} />
          {/* 左上の丸アイコン（ティファニーのリング=FBの青リング） */}
          <span className="absolute left-1.5 top-1.5 h-8 w-8 overflow-hidden rounded-full" style={{ border: `2.5px solid ${TIFFANY}` }}>
            {st.profiles?.avatar_url ? (
              <img src={srcCdn(st.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[#cfe8d8] text-[13px]">🌿</span>
            )}
          </span>
          <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-left text-[10px] font-bold text-white">
            {st.profiles?.display_name ?? "むらびと"}
          </span>
        </button>
      ))}
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
                  <img src={srcCdn(ev.photo_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-[12px] font-bold text-white"
                    style={{ background: "linear-gradient(160deg,#4a9a5a,#1e4530)" }}
                  >
                    🏡 {ev.villages?.name ?? "セカイムラ"}
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
        out.pop();
        out.push(<BandDouble key={`bd-${feedKey(it)}`} />);
        out.push(<div key="ev-strip">{eventStrip}</div>);
        out.push(<BandDouble key="ev-band" />);
      }
      if (i === 7 && shopStrip) {
        out.pop();
        out.push(<BandDouble key={`bd2-${feedKey(it)}`} />);
        out.push(<div key="shop-strip">{shopStrip}</div>);
        out.push(<BandDouble key="shop-band" />);
      }
      if (i === 12) {
        out.pop();
        out.push(<BandDouble key={`bd3-${feedKey(it)}`} />);
        out.push(
          <div key="villagers" className="py-2.5">
            <VillagerSuggestions title="✨ おすすめのむらびと" />
          </div>
        );
        out.push(<BandDouble key="villagers-band" />);
      }
    });
    return out;
  };

  return (
    <main className="min-h-screen bg-white pb-20">
      {/* ヘッダー: ☰ + CotoZute（ティファニーブルー） */}
      <header
        className="sticky top-0 z-40 bg-white"
        style={{
          transform: hideBar ? "translateY(-110%)" : "translateY(0)",
          transition: "transform 0.18s cubic-bezier(0.2,0.8,0.3,1)",
        }}
      >
        <div className="flex h-12 items-center gap-3 px-4">
          <button onClick={() => setDrawer(true)} aria-label="メニュー" className="text-[22px] leading-none text-[#1c1e21]">
            ☰
          </button>
          <span className="text-[22px] font-extrabold tracking-tight" style={{ color: TIFFANY }}>
            CotoZute →
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
            {MENU_ITEMS.map((m) => {
              const isHere = m.href === "/cotozute";
              const rowCls = `flex items-center gap-3 border-b border-[#f2f3f5] px-5 py-3 text-[14px] no-underline ${
                isHere ? "bg-[#e5f6fb] font-bold text-[#1B8FB5]" : "font-medium text-[#1c1e21]"
              }`;
              return m.ext ? (
                <a key={m.href} href={m.href} className={rowCls}>
                  {m.icon.startsWith("/") ? (
                    <img src={srcCdn(m.icon)} alt="" className="h-[22px] w-[22px] object-contain" />
                  ) : (
                    <span className="w-[22px] text-center text-[17px]">{m.icon}</span>
                  )}
                  {m.label}
                </a>
              ) : (
                <Link key={m.href} href={m.href} onClick={() => setDrawer(false)} className={rowCls}>
                  {m.icon.startsWith("/") ? (
                    <img src={srcCdn(m.icon)} alt="" className="h-[22px] w-[22px] object-contain" />
                  ) : (
                    <span className="w-[22px] text-center text-[17px]">{m.icon}</span>
                  )}
                  {m.label}
                </Link>
              );
            })}
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

      <UpgradeDialog open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="CotoZuteへの投稿" />
      <div className="px-4" ref={feedRef}>
        {/* 投稿ボックス（FB型: アバター + 丸ボックス + 写真） */}
        <div className="flex items-center gap-2.5 py-2.5">
          {myAvatar ? (
            <img src={srcCdn(myAvatar)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[16px]">🌿</span>
          )}
          <button
            onClick={() => (me && isWara ? setComposing(true) : setShowUpgrade(true))}
            className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14.5px] text-[#65676b]"
          >
            幸せの波紋を拡げよう
          </button>
        </div>

        {/* ストーリーズ（24時間で消える） */}
        {storiesRow}
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
            {hasMore &&
              (items.length >= autoLimit ? (
                <div className="flex justify-center bg-white py-5">
                  <button
                    onClick={() => {
                      setAutoLimit(items.length + 30);
                      loadMore();
                    }}
                    className="rounded-full border border-[#dcdfe4] bg-white px-6 py-2.5 text-[13.5px] font-bold text-[#2CB7DE]"
                  >
                    続きを読み込む
                  </button>
                </div>
              ) : (
                <div className="flex justify-center bg-white py-6">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d8dade] border-t-transparent" />
                </div>
              ))}
          </>
        )}
      </div>

      {/* ストーリー作成エディタ（ネオン文字を写真に乗せる） */}
      {storyDraft && (
        <div className="fixed inset-0 z-[93] flex flex-col bg-black" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div ref={storyBoxRef} className="relative flex-1 overflow-hidden">
            <img src={srcCdn(storyDraft.url)} alt="" className="absolute inset-0 h-full w-full object-contain" />
            {storyText.trim() && (
              <div
                className="absolute cursor-grab touch-none select-none whitespace-pre-wrap text-center font-extrabold"
                style={{
                  left: `${storyPos.x * 100}%`,
                  top: `${storyPos.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${storyRot}deg)`,
                  fontSize: storySize,
                  color: "#fff",
                  textShadow: `0 0 6px ${storyColor}, 0 0 18px ${storyColor}, 0 0 34px ${storyColor}`,
                  lineHeight: 1.25,
                  maxWidth: "150%",
                }}
                onTouchStart={(e) => {
                  if (e.touches.length === 2) {
                    const [a, b] = [e.touches[0], e.touches[1]];
                    storyPinch.current = {
                      d0: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
                      a0: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
                      size0: storySize,
                      rot0: storyRot,
                    };
                  }
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 2 && storyPinch.current) {
                    // ピンチ=大きさ / 二本指の回転=角度
                    const [a, b] = [e.touches[0], e.touches[1]];
                    const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                    const ang = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
                    setStorySize(Math.min(90, Math.max(13, storyPinch.current.size0 * (d / storyPinch.current.d0))));
                    setStoryRot(storyPinch.current.rot0 + ((ang - storyPinch.current.a0) * 180) / Math.PI);
                    return;
                  }
                  const r = storyBoxRef.current?.getBoundingClientRect();
                  if (!r) return;
                  const t = e.touches[0];
                  setStoryPos({
                    x: Math.min(0.95, Math.max(0.05, (t.clientX - r.left) / r.width)),
                    y: Math.min(0.92, Math.max(0.08, (t.clientY - r.top) / r.height)),
                  });
                }}
                onTouchEnd={(e) => {
                  if (e.touches.length < 2) storyPinch.current = null;
                }}
                onMouseDown={(e) => {
                  const r = storyBoxRef.current?.getBoundingClientRect();
                  if (!r) return;
                  const onMove = (ev: MouseEvent) => {
                    setStoryPos({
                      x: Math.min(0.95, Math.max(0.05, (ev.clientX - r.left) / r.width)),
                      y: Math.min(0.92, Math.max(0.08, (ev.clientY - r.top) / r.height)),
                    });
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                  e.preventDefault();
                }}
              >
                {storyText}
              </div>
            )}
            {storyText.trim() && (
              <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10.5px] text-white/50">
                1本指で移動 ・ 2本指でひらいて拡大 / ひねって回転
              </div>
            )}
          </div>
          <div className="px-4 pb-4 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}>
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              rows={2}
              placeholder="ネオン文字を入れる（改行OK・空欄でもOK）"
              className="w-full resize-none rounded-xl bg-white/12 px-3 py-2.5 text-[15px] font-bold text-white outline-none placeholder:text-white/40"
            />
            <div className="mt-2.5 flex items-center gap-3">
              {["#0affd0", "#ff3db8", "#ffd93d", "#4dc3ff", "#b04dff"].map((c) => (
                <button
                  key={c}
                  onClick={() => setStoryColor(c)}
                  aria-label="ネオン色"
                  className="h-8 w-8 rounded-full"
                  style={{
                    background: c,
                    boxShadow: `0 0 12px ${c}`,
                    border: storyColor === c ? "3px solid #fff" : "3px solid transparent",
                  }}
                />
              ))}
              <button
                onClick={() => {
                  URL.revokeObjectURL(storyDraft.url);
                  setStoryDraft(null);
                }}
                className="ml-auto px-2 py-2 text-[13px] font-bold text-white/70"
              >
                やめる
              </button>
              <button
                onClick={bakeAndPost}
                disabled={storyUploading}
                className="rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-50"
                style={{ background: TIFFANY }}
              >
                {storyUploading ? "投稿中..." : "シェアする"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ストーリービューア（全画面・タップで次へ） */}
      {storyView != null && stories[storyView] && (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-black"
          onClick={() => {
            if (storySwipe.current?.moved) return;
            setStoryView(storyView + 1 < stories.length ? storyView + 1 : null);
          }}
          onTouchStart={(e) => {
            storySwipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
          }}
          onTouchMove={(e) => {
            if (!storySwipe.current) return;
            if (Math.abs(e.touches[0].clientX - storySwipe.current.x) > 12) storySwipe.current.moved = true;
          }}
          onTouchEnd={(e) => {
            const sw = storySwipe.current;
            if (!sw) return;
            const dx = e.changedTouches[0].clientX - sw.x;
            if (dx < -40) setStoryView(storyView + 1 < stories.length ? storyView + 1 : null); // 左スワイプ→次
            else if (dx > 40) setStoryView(storyView > 0 ? storyView - 1 : storyView); // 右スワイプ→前
            setTimeout(() => (storySwipe.current = null), 50);
          }}
        >
          <img src={srcCdn(stories[storyView].image_url)} alt="" className="max-h-full w-full object-contain" />
          <div className="absolute left-3 top-3 flex items-center gap-2" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <span className="h-9 w-9 overflow-hidden rounded-full" style={{ border: `2px solid ${TIFFANY}` }}>
              {stories[storyView].profiles?.avatar_url ? (
                <img src={srcCdn(stories[storyView].profiles!.avatar_url!)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-[#cfe8d8] text-[14px]">🌿</span>
              )}
            </span>
            <div>
              <div className="text-[13px] font-bold text-white">{stories[storyView].profiles?.display_name ?? "むらびと"}</div>
              <div className="text-[10.5px] text-white/70">
                {Math.max(1, Math.round((Date.now() - new Date(stories[storyView].created_at).getTime()) / 3600000))}時間前
              </div>
            </div>
          </div>
          {me?.id === stories[storyView].user_id && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!confirm("このストーリーズを削除しますか？")) return;
                await deleteStory(stories[storyView].id, me.id);
                setStoryView(null);
                setStoriesList(await fetchStories());
              }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-[12px] font-bold text-white"
            >
              削除
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStoryView(null);
            }}
            aria-label="閉じる"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[16px] text-white"
            style={{ marginTop: "env(safe-area-inset-top)" }}
          >
            ×
          </button>
        </div>
      )}

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
