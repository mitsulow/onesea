"use client";

import { markSeen } from "@/lib/follows";
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
import { MuraFeedCard, MoaiFeedCard, ShopStripCard } from "@/components/FeedCards";
import { AvatarMenu } from "@/components/AvatarMenu";
import { UpgradeDialog } from "@/components/UpgradeGate";
import { VillagerSuggestions } from "@/components/VillagerSuggestions";
import { DragScroll } from "@/components/DragScroll";
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
  { href: "/cotozute", icon: "/icons/tab-cotozute2.webp", label: "コトヅテ" },
  { href: "/", icon: "/icons/tab-home.png", label: "OneSea" },
  { href: "/za", icon: "/rakuichi/logo-emblem.webp", label: "楽市楽座" },
  { href: "/#techo", icon: "/icons/icon-techo.webp", label: "手帳", ext: true },
  { href: "/my", icon: "/icons/icon-profile.webp", label: "マイページ編集" },
  { href: "/talk", icon: "/icons/icon-chat.webp", label: "TalK" },
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
  const [moais, setMoais] = useState<any[]>([]);
  const [storyView, setStoryView] = useState<number | null>(null); // 表示中のストーリーindex
  const [storyUploading, setStoryUploading] = useState(false);
  const [storyDraft, setStoryDraft] = useState<{ file: File; url: string } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false); // 投稿はわらわ〜会員専用
  const [isWara, setIsWara] = useState(false);
  const [autoLimit, setAutoLimit] = useState(30); // 無限スクロールは30件ごとに一時停止
  const [schumannHz, setSchumannHz] = useState<number | null>(null); // 右レール「今日の地球」用
  const [storyText, setStoryText] = useState("");
  const [storyColor, setStoryColor] = useState("#0affd0");
  const [storyPos, setStoryPos] = useState({ x: 0.5, y: 0.5 }); // 文字位置（自由ドラッグ）
  const [storySize, setStorySize] = useState(30); // 文字サイズ（プレビューpx・ピンチで変更）
  const [storyRot, setStoryRot] = useState(0); // 回転（度・二本指）
  const storyPinch = useRef<{ d0: number; a0: number; size0: number; rot0: number } | null>(null);
  const storyDrag = useRef<{ x0: number; y0: number; px: number; py: number } | null>(null); // 1本指ドラッグ(相対移動)
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

  // 右レール「今日の地球」: 日付・月齢・シューマン共振
  const todayLabel = (() => {
    const n = new Date();
    return `${n.getMonth() + 1}月${n.getDate()}日（${"日月火水木金土"[n.getDay()]}）`;
  })();
  const moonAge = (() => {
    const SYN = 29.530588853;
    const BASE = Date.UTC(2000, 0, 6, 18, 14);
    const a = ((Date.now() - BASE) / 86400000) % SYN;
    return a < 0 ? a + SYN : a;
  })();
  useEffect(() => {
    fetch("/api/sr/schumann_data.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSchumannHz(d?.modes?.F1?.hz ?? null))
      .catch(() => {});
  }, []);

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
    fetchMixedFeed(null, PAGE).then(async (list) => {
      // ★新着順が最優先（同じ古い投稿がずっと上に居座らないように）
      try {
        const meta = (it: FeedItem) =>
          it.kind === "coto"
            ? { id: it.post.id, uid: it.post.user_id, at: it.post.created_at, likes: it.post.likes?.[0]?.count ?? 0 }
            : it.kind === "mura"
              ? { id: it.mura.id, uid: it.mura.user_id ?? "", at: it.mura.created_at, likes: 0 }
              : { id: feedKey(it), uid: "", at: new Date(0).toISOString(), likes: 0 };
        list = [...list].sort((a, b) => new Date(meta(b).at).getTime() - new Date(meta(a).at).getTime());
        markSeen(list.map((it) => meta(it).id));
      } catch {}
      setItems(list);
      itemsRef.current = list;
      setHasMore(list.length > 0);
      loadLikers(list);
    });
    fetchLatestShops(10).then(setShops);
    import("@/lib/moai").then(({ fetchMoais }) => fetchMoais().then((r) => setMoais(r.slice(0, 12)))).catch(() => {});
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
    <DragScroll className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-2.5">
      {/* 一番左: ストーリーズを作成 */}
      {me && (
        <label className="relative h-[168px] w-[106px] flex-shrink-0 cursor-pointer overflow-hidden rounded-xl border border-[#e4e6e9] bg-white">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => postStory(e.target.files?.[0] ?? null)} />
          <div className="h-[104px] w-full bg-[#f0f2f5]">
            {myAvatar ? (
              <img src={srcCdn(myAvatar)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[28px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 30, height: 30 }} /></div>
            )}
          </div>
          <span
            className="absolute left-1/2 top-[104px] flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white text-[18px] font-extrabold text-white"
            style={{ background: TIFFANY }}
          >
            ＋
          </span>
          <div className="px-1 pt-5 text-center text-[10.5px] font-bold leading-snug text-[#1c1e21]">
            {storyUploading ? "投稿中..." : "消える言伝を作成"}
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
              <span className="flex h-full w-full items-center justify-center bg-[#cfe8d8] text-[13px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 16, height: 16 }} /></span>
            )}
          </span>
          <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate text-left text-[10px] font-bold text-white">
            {st.profiles?.display_name ?? "むらびと"}
          </span>
        </button>
      ))}
    </DragScroll>
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
      <DragScroll className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {shops.map((sh) => (
          <ShopStripCard key={sh.id} shop={sh} />
        ))}
      </DragScroll>
    </div>
  );

  /* 部員募集！ MOAIサークル横スクロール */
  const moaiStrip = moais.length > 0 && (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-[#1c1e21]">
          <img src="/icons/icon-moai.webp" alt="" className="h-[18px] w-[18px] rounded-full object-cover" /> 部員募集！
        </span>
        <Link href="/moai" className="text-[12px] font-bold no-underline" style={{ color: "#c0392b" }}>すべて見る</Link>
      </div>
      <DragScroll className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {moais.map((m) => (
          <Link key={m.id} href={`/moai/${m.id}`} className="w-[132px] flex-shrink-0 overflow-hidden rounded-xl border border-[#f0d8d4] bg-white no-underline shadow-sm">
            <div className="relative h-[84px] bg-[#f6e4e0]">
              {m.cover_url ? <img src={srcCdn(m.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[22px]">🗿</div>}
              <span className="absolute -bottom-3 left-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#f3ded9] text-[13px]">{m.icon_url ? <img src={srcCdn(m.icon_url)} alt="" className="h-full w-full object-cover" /> : "🗿"}</span>
            </div>
            <div className="px-2 pb-1.5 pt-4">
              <div className="truncate text-[11.5px] font-bold text-[#3a2420]">{m.name}</div>
              <div className="mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold text-white" style={{ background: "#c0392b" }}>入部希望 →</div>
            </div>
          </Link>
        ))}
      </DragScroll>
    </div>
  );

  /* イベント横スクロール（中盤・リール位置） */
  const eventStrip = events.length > 0 && (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between px-0.5">
        <span className="text-[13.5px] font-bold text-[#1c1e21]"><img src="/icons/icon-calendar.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} /> イベント</span>
        <Link href="/sekai" className="text-[12px] font-bold no-underline" style={{ color: TIFFANY }}>
          すべて見る
        </Link>
      </div>
      <DragScroll className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
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
                    <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> {ev.villages?.name ?? "セカイムラ"}
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
      </DragScroll>
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
          ) : it.kind === "moai" ? (
            <MoaiFeedCard post={it.moaiPost} />
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
      if (i === 9 && moaiStrip) {
        out.pop();
        out.push(<BandDouble key={`bd4-${feedKey(it)}`} />);
        out.push(<div key="moai-strip">{moaiStrip}</div>);
        out.push(<BandDouble key="moai-band" />);
      }
      if (i === 12) {
        out.pop();
        out.push(<BandDouble key={`bd3-${feedKey(it)}`} />);
        out.push(
          <div key="villagers" className="py-2.5">
            <VillagerSuggestions title="おすすめのむらびと" />
          </div>
        );
        out.push(<BandDouble key="villagers-band" />);
      }
    });
    return out;
  };

  return (
    <main
      className="min-h-screen pb-20"
      style={{ background: "#f0f2f5", width: "100vw", marginLeft: "calc(50% - 50vw)" }}
    >
      {/* ヘッダー: ☰ + CotoZute（ティファニーブルー） */}
      <header
        className="sticky top-0 z-40 bg-white"
        style={{
          transform: hideBar ? "translateY(-110%)" : "translateY(0)",
          transition: "transform 0.18s cubic-bezier(0.2,0.8,0.3,1)",
        }}
      >
        <div className="flex h-[52px] items-center gap-3 px-4">
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

      {/* デスクトップは Facebook/Instagram 型の3カラム。中央フィードは細いまま、両脇にレール */}
      <div className="mx-auto flex w-full max-w-[1180px] justify-center gap-5 lg:px-4">
        {/* 左レール: サービスへの入口ナビ（lgのみ・追従） */}
        <aside className="hidden w-[240px] shrink-0 pt-4 lg:block">
          <div className="sticky top-16 rounded-xl border border-[#e4e6e9] bg-white p-2">
            {MENU_ITEMS.map((m) =>
              m.ext ? (
                <a key={m.href} href={m.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#1c1e21] no-underline hover:bg-[#f2f3f5]">
                  {m.icon.startsWith("/") ? <img src={srcCdn(m.icon)} alt="" className="h-[22px] w-[22px] object-contain" /> : <span className="w-[22px] text-center text-[17px]">{m.icon}</span>}
                  {m.label}
                </a>
              ) : (
                <Link key={m.href} href={m.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-[#1c1e21] no-underline hover:bg-[#f2f3f5]">
                  {m.icon.startsWith("/") ? <img src={srcCdn(m.icon)} alt="" className="h-[22px] w-[22px] object-contain" /> : <span className="w-[22px] text-center text-[17px]">{m.icon}</span>}
                  {m.label}
                </Link>
              )
            )}
          </div>
        </aside>

        {/* 中央フィード（スマホ幅のまま中央に） */}
        <div className="w-full max-w-[600px] bg-white px-4 lg:rounded-xl lg:border lg:border-[#e4e6e9]" ref={feedRef}>
        {/* 投稿ボックス（FB型: アバター + 丸ボックス + 写真） */}
        <div className="flex items-center gap-2.5 py-2.5">
          {myAvatar ? (
            <img src={srcCdn(myAvatar)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[16px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 18, height: 18 }} /></span>
          )}
          <button
            onClick={() => (me && isWara ? setComposing(true) : setShowUpgrade(true))}
            className="flex-1 rounded-full border border-[#dcdfe4] bg-white px-4 py-2 text-left text-[14.5px] text-[#65676b]"
          >
            幸せの波紋を拡げよう <img src="/icons/icon-pen.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
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
          <p className="py-12 text-center text-[13px] text-[#8a8d91]">まだ投稿がありません。最初のひとことをどうぞ <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></p>
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

        {/* 右レール: キャンペーン・イベント・楽市楽座・おすすめ（lgのみ・追従） */}
        <aside className="hidden w-[300px] shrink-0 pt-4 lg:block">
          <div className="sticky top-16 space-y-3">
            {/* 今日の地球（会員も楽しめる暮らしの情報） */}
            <div className="overflow-hidden rounded-xl border border-[#e4e6e9] bg-white p-4">
              <div className="text-[12px] font-bold text-[#65676b]"><img src="/icons/cel-earth.png" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 今日の地球</div>
              <div className="num mt-2 text-[15px] font-extrabold text-[#1c1e21]">{todayLabel}</div>
              <div className="mt-1.5 text-[12px] text-[#65676b]">
                月齢 <b className="num text-[#3a3428]">{moonAge.toFixed(1)}</b>
                <span className="mx-1.5 text-[#c8ccd1]">・</span>
                シューマン共振 <b className="num text-[#2CB7DE]">{schumannHz ? schumannHz.toFixed(2) : "—"}</b> Hz
              </div>
              <Link href="/mmm" className="mt-2.5 inline-block text-[12px] font-bold text-[#2CB7DE] no-underline">
                いまの地球の音を聴く →
              </Link>
            </div>

            {events.length > 0 && (
              <div className="rounded-xl border border-[#e4e6e9] bg-white p-3">
                <div className="mb-1.5 px-1 text-[12px] font-bold text-[#65676b]"><img src="/icons/icon-calendar.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -3 }} /> これからのイベント</div>
                {events.slice(0, 4).map((ev) => (
                  <Link key={ev.id} href={`/sekai/village/${ev.villages?.id}`} className="block rounded-lg px-1 py-1.5 no-underline hover:bg-[#f2f3f5]">
                    <div className="truncate text-[12.5px] font-bold text-[#1c1e21]">{String(ev.body ?? "").split("\n")[0]}</div>
                    <div className="num text-[11px] text-[#8a8d91]">
                      {new Date(ev.event_at).getMonth() + 1}/{new Date(ev.event_at).getDate()} ・ {ev.villages?.name ?? "セカイムラ"}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {shops.length > 0 && (
              <div className="rounded-xl border border-[#e4e6e9] bg-white p-3">
                <div className="mb-1.5 px-1 text-[12px] font-bold text-[#65676b]"><img src="/icons/icon-listing.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -3 }} /> 新着の楽市楽座</div>
                {shops.slice(0, 4).map((sh) => (
                  <Link key={sh.id} href={`/za/${sh.id}`} className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 no-underline hover:bg-[#f2f3f5]">
                    {sh.thumb_urls?.[0] || sh.image_urls?.[0] ? (
                      <img src={srcCdn(sh.thumb_urls?.[0] ?? sh.image_urls[0])} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#f0f2f5] text-[15px]"><img src="/icons/icon-listing.webp" alt="" style={{ width: 20, height: 20 }} /></span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-bold text-[#1c1e21]">{sh.name}</div>
                      <div className="num text-[11px] text-[#c94d3a]">{sh.is_trial ? "お試し" : sh.price_jpy ? `¥${sh.price_jpy.toLocaleString()}` : "0円"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-[#e4e6e9] bg-white p-3">
              <VillagerSuggestions title="おすすめのむらびと" variant="list" />
            </div>
          </div>
        </aside>
      </div>

      {/* ストーリー作成エディタ（ネオン文字を写真に乗せる） */}
      {storyDraft && (
        <div className="fixed inset-0 z-[93] flex flex-col bg-black" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div
            ref={storyBoxRef}
            className="relative flex-1 overflow-hidden"
            style={{ touchAction: "none" }}
            onTouchStart={(e) => {
              if (!storyText.trim()) return;
              if (e.touches.length >= 2) {
                const [a, b] = [e.touches[0], e.touches[1]];
                storyPinch.current = {
                  d0: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
                  a0: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX),
                  size0: storySize,
                  rot0: storyRot,
                };
                storyDrag.current = null;
              } else {
                const t = e.touches[0];
                storyDrag.current = { x0: t.clientX, y0: t.clientY, px: storyPos.x, py: storyPos.y };
              }
            }}
            onTouchMove={(e) => {
              if (!storyText.trim()) return;
              if (e.touches.length >= 2 && storyPinch.current) {
                const [a, b] = [e.touches[0], e.touches[1]];
                const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
                const ang = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
                setStorySize(Math.min(90, Math.max(13, storyPinch.current.size0 * (d / storyPinch.current.d0))));
                let rot = storyPinch.current.rot0 + ((ang - storyPinch.current.a0) * 180) / Math.PI;
                rot = ((rot % 360) + 540) % 360 - 180;
                if (Math.abs(rot) < 6) rot = 0; // まっすぐ付近はピタッと水平に吸い付く
                setStoryRot(rot);
                return;
              }
              const r = storyBoxRef.current?.getBoundingClientRect();
              const g = storyDrag.current;
              if (!r || !g) return;
              const t = e.touches[0];
              setStoryPos({
                x: Math.min(0.95, Math.max(0.05, g.px + (t.clientX - g.x0) / r.width)),
                y: Math.min(0.92, Math.max(0.08, g.py + (t.clientY - g.y0) / r.height)),
              });
            }}
            onTouchEnd={(e) => {
              if (e.touches.length < 2) storyPinch.current = null;
              if (e.touches.length === 0) storyDrag.current = null;
            }}
            onMouseDown={(e) => {
              if (!storyText.trim()) return;
              const r = storyBoxRef.current?.getBoundingClientRect();
              if (!r) return;
              const g = { x0: e.clientX, y0: e.clientY, px: storyPos.x, py: storyPos.y };
              const onMove = (ev: MouseEvent) => {
                setStoryPos({
                  x: Math.min(0.95, Math.max(0.05, g.px + (ev.clientX - g.x0) / r.width)),
                  y: Math.min(0.92, Math.max(0.08, g.py + (ev.clientY - g.y0) / r.height)),
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
            <img src={srcCdn(storyDraft.url)} alt="" className="absolute inset-0 h-full w-full object-contain" />
            {storyText.trim() && (
              <div
                className="pointer-events-none absolute select-none whitespace-pre-wrap text-center font-extrabold"
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
              >
                {storyText}
              </div>
            )}
            {storyText.trim() && (
              <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-[10.5px] text-white/50">
                画面のどこを触ってもOK: 1本指で移動 ・ 2本指で拡大/かたむき
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
            {storyText.trim() && (
              <div className="mt-2 flex items-center gap-2 text-[10.5px] font-bold text-white/75">
                <span className="flex-shrink-0">大きさ</span>
                <input
                  type="range"
                  min={13}
                  max={90}
                  value={Math.round(storySize)}
                  onChange={(e) => setStorySize(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-white"
                />
                <span className="flex-shrink-0">ナナメ</span>
                <input
                  type="range"
                  min={-45}
                  max={45}
                  value={Math.round(Math.min(45, Math.max(-45, storyRot)))}
                  onChange={(e) => setStoryRot(Number(e.target.value))}
                  className="min-w-0 flex-1 accent-white"
                />
                <button onClick={() => setStoryRot(0)} className="flex-shrink-0 rounded-full bg-white/15 px-2 py-1">
                  水平
                </button>
              </div>
            )}
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
                キャンセル
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
                <span className="flex h-full w-full items-center justify-center bg-[#cfe8d8] text-[14px]"><img src="/icons/icon-leaf.webp" alt="" style={{ width: 16, height: 16 }} /></span>
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
                if (!confirm("この消える言伝を削除しますか？")) return;
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
            className="h-full w-full max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] overflow-y-auto bg-white"
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
