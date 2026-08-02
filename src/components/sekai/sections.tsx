"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateChat, sendMessage } from "@/lib/line";
import { uploadImage } from "@/lib/images";
import {
  PREFS,
  MEISTER_SKILLS,
  Moot,
  upcomingMoots,
  nextMisoka,
  fetchMootData,
  toggleRsvp,
  myMootCount,
  fetchSettings,
  mootTimeOf,
  fetchLounge,
  postLounge,
  villagersOf,
  recentVillagers,
  Village,
  fetchVillages,
  fetchActivityFeed,
  createVillage,
  joinVillage,
  myVillageIds,
  POLICY_LABEL,
  Club,
  fetchClubs,
  createClub,
  joinClub,
  myClubIds,
  fetchTanbo,
  addTanbo,
  fetchJinja,
  addJinja,
  fetchMeister,
  toggleMeister,
  meisterTeachers,
  fetchTasukete,
  addTasukete,
  closeTasukete,
} from "@/lib/sekai";
import {
  detectPrefecture,
  OVERSEAS_AREAS,
  VillagePostComment,
  fetchVillagePostComments,
  addVillagePostComment,
  writeMootToTecho,
  removeMootFromTecho,
} from "@/lib/sekai";
import JP_CITIES_JSON from "@/data/jp-cities.json";

const JP_CITIES = JP_CITIES_JSON as Record<string, string[]>;

/** 本文中のURLをリンク化（別タブで開く） */
const URL_RE = /(https?:\/\/[^\s]+)/g;
export function linkify(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline"
        style={{ color: "#2a7ab8" }}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
import { SekaiMap } from "@/components/sekai/SekaiMap";
import { CameraIcon } from "@/components/CameraIcon";
import { PriceBanner } from "@/components/PriceBanner";
import { AvatarMenu } from "@/components/AvatarMenu";
import { moonsOfYear, YOBI, keyOf } from "@/lib/almanac";
import { MEISTER_COURSES } from "@/data/meister-courses";
import { LATEST_MOOT_VIDEO, PAST_MOOT_VIDEOS } from "@/data/moot-videos";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const GREEN = "#3a7a4c";
const DARKGREEN_BG = "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)";

export function AvatarSm({ p, size = 34 }: { p: any; size?: number }) {
  const inner = p?.avatar_url ? (
    <img
      src={p.avatar_url}
      alt=""
      referrerPolicy="no-referrer"
      style={{ width: size, height: size }}
      className="rounded-full object-cover"
    />
  ) : (
    <div
      style={{ width: size, height: size, background: "linear-gradient(140deg,#cfe8d8,#9cc8ac)" }}
      className="flex items-center justify-center rounded-full text-[15px]"
    >
      🌿
    </div>
  );
  return p?.username ? (
    <Link href={`/u/${p.username}`} className="flex-shrink-0">
      {inner}
    </Link>
  ) : (
    <span className="flex-shrink-0">{inner}</span>
  );
}

export const SectionTitle = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div className="mb-2.5">
    <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
      {children}
    </span>
    {sub && <span className="ml-2 text-[11px] font-normal text-[#a0aca0]">{sub}</span>}
  </div>
);

/** 各ページ共通: ログインユーザーと地域・集い参加回数 */
export function useSekaiMe() {
  const [me, setMe] = useState<User | null>(null);
  const [myPref, setMyPref] = useState<string>("東京都");
  const [mootCount, setMootCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) {
        const { data } = await supabase.from("profiles").select("prefecture").eq("id", u.id).maybeSingle();
        if (data?.prefecture && ([...PREFS, "海外"] as readonly string[]).includes(data.prefecture)) {
          // マイページで編集した都道府県が最優先
          setMyPref(data.prefecture);
        } else {
          // 未設定なら位置情報から推定して、プロフィールにも保存しておく
          const g = await detectPrefecture();
          if (g) {
            setMyPref(g);
            supabase.from("profiles").update({ prefecture: g }).eq("id", u.id).then(() => {});
          }
        }
        setMootCount(await myMootCount(u.id));
      }
    });
  }, []);

  const refreshMootCount = useCallback(() => {
    if (me) myMootCount(me.id).then(setMootCount);
  }, [me]);

  return { me, myPref, mootCount, refreshMootCount };
}

/** 各ページ共通の外枠（コンパクトなヒーロー + 右上アイコンはOneSeaと同じメニュー） */
export function SekaiShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pb-44">
      <header className="relative z-[60] px-6 py-2 text-center" style={{ background: DARKGREEN_BG }}>
        <div className="text-[10px] leading-tight tracking-[3px] text-[#a8cca8]">世界は一つの村になる。</div>
        <div className="text-[17px] font-extrabold leading-snug tracking-[6px] text-[#eae6b8]">セカイムラ</div>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-left">
          <AvatarMenu />
        </span>
      </header>
      <PriceBanner service="セカイムラ" price="月額3,000円" color="#7ad8a8" />
      {/* セクション同士は地色の隙間で区切る（どこからどこまでが1つか分かるように） */}
      <div className="space-y-2.5" style={{ background: "#e8e4d8" }}>{children}</div>
    </main>
  );
}

/* ═══ 集い（満月会・新月会） ═══ */
export function MootsSection({
  me,
  myPref,
  mootCount,
  onRsvped,
}: {
  me: User | null;
  myPref: string;
  mootCount: number;
  onRsvped: () => void;
}) {
  void myPref;
  const [moots] = useState<Moot[]>(() => upcomingMoots(1));
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetchMootData(
      moots.map((m) => m.dateKey),
      me?.id ?? null
    );
    setCounts(r.counts);
    setMine(r.mine);
  }, [me, moots]);

  useEffect(() => {
    load();
    fetchSettings().then(setSettings);
  }, [load]);

  const next = moots[0];
  const joined = next ? mine.has(next.dateKey) : false;
  const today = next?.dday === 0;

  const rsvp = async () => {
    if (!me || !next) return;
    await toggleRsvp(me.id, next.dateKey, next.kind, joined);
    // 参加します → 手帳のその日時に自動でスケジュール（取消で消える）
    if (joined) removeMootFromTecho(next);
    else writeMootToTecho(next);
    await load();
    onRsvped();
  };

  return (
    <section
      id="moots"
      className="card"
      style={{ background: "linear-gradient(150deg,#0f1a25,#1a2a38)", border: "none", padding: "10px 8px 12px", scrollMarginTop: 56 }}
    >
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[13.5px] font-extrabold tracking-[1px] text-[#7aa88a]">
          📺 セカイムラオンライン満月会・新月会
        </span>
        {me && <span className="text-[10px] text-[#5a7a68]">あなたの参加 {mootCount}回</span>}
      </div>

      {/* テレビ画面（当日はここにZoomの導線が出る） */}
      {next && (
        <div className="relative overflow-hidden rounded-xl border border-[#2a4a3a]">
          <img src="/sekai/zoom-tv.webp" alt="" className="w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(8,16,24,.6) 0%, rgba(8,16,24,.05) 45%, rgba(8,16,24,.74) 100%)" }}
          />
          {/* 案内文 */}
          <div className="absolute left-0 right-0 top-2.5 px-3 text-center">
            <div className="text-[14px] font-extrabold leading-snug text-white" style={{ textShadow: "0 2px 10px rgba(0,0,0,.85)" }}>
              次のセカイムラ{next.kind === "new" ? "新月会" : "満月会"}は
              <span className="num"> {next.label}{next.hour}時〜 </span>です
            </div>
            <div className="num mt-0.5 text-[10.5px] text-[#b8d8c8]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.85)" }}>
              {today ? "今日！" : next.dday === 1 ? "明日" : `あと${next.dday}日`} ・ {counts.get(next.dateKey) ?? 0}人が参加予定
            </div>
          </div>
          {/* ボタン */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-center gap-2">
            {today && settings.zoom_url ? (
              <>
                <a
                  href={settings.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl bg-[#2d8cff] py-2.5 text-center text-[13.5px] font-extrabold text-white no-underline"
                >
                  Zoomで参加する
                </a>
                {settings.youtube_url && (
                  <a
                    href={settings.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl bg-[#f00] py-2.5 text-center text-[13.5px] font-extrabold text-white no-underline"
                  >
                    YouTubeで視聴
                  </a>
                )}
              </>
            ) : me ? (
              <button
                onClick={rsvp}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold"
                style={
                  joined
                    ? { background: "rgba(42,90,58,.92)", color: "#a8d8b8", border: "1px solid #4a9a6a" }
                    : { background: "#d4b96a", color: "#1a2432" }
                }
              >
                {joined ? "✓ 参加します（タップで取消）" : "参加します"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* 開催されたら、今回の動画がここに */}
      {LATEST_MOOT_VIDEO && (
        <a
          href={LATEST_MOOT_VIDEO.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 mt-2 block overflow-hidden rounded-xl border border-[#4a9a6a]/40 no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LATEST_MOOT_VIDEO.thumb} alt="" className="w-full object-cover" />
          <div className="bg-white/5 px-3 py-2 text-[12.5px] font-extrabold text-[#a8d8b8]">
            ▶ {LATEST_MOOT_VIDEO.title} — 今回の会の動画
          </div>
        </a>
      )}

      {/* 過去の新月会・満月会 動画（サムネ） */}
      {PAST_MOOT_VIDEOS.length > 0 && (
        <div className="mb-1 mt-2 px-1">
          <div className="mb-1 text-[10px] tracking-[2px] text-[#5a7a68]">過去の新月会・満月会 動画</div>
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
            {PAST_MOOT_VIDEOS.map((v, i) =>
              v.url ? (
                <a
                  key={i}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-[104px] flex-shrink-0 overflow-hidden rounded-lg no-underline"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt={v.title} className="aspect-video w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-[9px] text-white">
                      ▶
                    </span>
                  </span>
                </a>
              ) : (
                <div key={i} className="w-[104px] flex-shrink-0 overflow-hidden rounded-lg opacity-70">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt={v.title} className="aspect-video w-full object-cover" />
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* 過去の新月満月会（折りたたみ） */}
      <details className="mt-2 px-1">
        <summary className="cursor-pointer list-none text-[11.5px] font-bold text-[#7aa88a]">
          📁 過去の新月満月会 ▾
        </summary>
        <MootArchive />
      </details>
    </section>
  );
}

/* ═══ 過去の新月満月会アーカイブ（2021年8月の満月会が第1回・通し番号） ═══ */
const ARCHIVE_YEARS = [2021, 2022, 2023, 2024, 2025, 2026];

function MootArchive() {
  const [year, setYear] = useState(new Date().getFullYear());

  const all = useMemo(() => {
    const list: Array<{ time: number; kind: "new" | "full"; no: number }> = [];
    const raw: Array<{ time: number; kind: "new" | "full" }> = [];
    for (const y of ARCHIVE_YEARS) {
      for (const ev of moonsOfYear(y)) {
        raw.push({ time: mootTimeOf(ev), kind: ev.type });
      }
    }
    raw.sort((a, b) => a.time - b.time);
    // 第1回 = 2021年8月以降で最初の満月会
    const firstIdx = raw.findIndex((m) => m.kind === "full" && m.time >= Date.UTC(2021, 7, 1));
    let no = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i < firstIdx) continue;
      no++;
      if (raw[i].time <= Date.now()) list.push({ ...raw[i], no });
    }
    return list;
  }, []);

  const list = all.filter((m) => new Date(m.time + 9 * 3600000).getUTCFullYear() === year);

  return (
    <div className="mt-2">
      {/* 年タブ */}
      <div className="hide-scrollbar flex gap-1.5 overflow-x-auto pb-1">
        {ARCHIVE_YEARS.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className="num flex-shrink-0 rounded-full border px-3 py-1 text-[11.5px] font-bold"
            style={
              year === y
                ? { background: "#2a5a3a", borderColor: "#4a9a6a", color: "#a8d8b8" }
                : { background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.12)", color: "#5a7a68" }
            }
          >
            {y}
          </button>
        ))}
      </div>
      {/* 一覧 */}
      {list.length === 0 ? (
        <p className="py-2 text-[11.5px] text-[#5a7a68]">この年の会はありません</p>
      ) : (
        <div className="mt-1 space-y-1">
          {list.map((m) => {
            const d = new Date(m.time + 9 * 3600000);
            return (
              <div key={m.time} className="flex items-baseline gap-2 rounded-lg bg-white/5 px-2.5 py-1.5">
                <span className="num w-14 flex-shrink-0 text-[10px] text-[#5a7a68]">第{m.no}回</span>
                <span className="text-[12px] font-bold" style={{ color: m.kind === "new" ? "#9ab8d8" : "#e8d5a0" }}>
                  {m.kind === "new" ? "🌑 新月会" : "🌕 満月会"}
                </span>
                <span className="num ml-auto flex-shrink-0 text-[11px] text-[#a8d8b8]">
                  {d.getUTCMonth() + 1}月{d.getUTCDate()}日（{YOBI[d.getUTCDay()]}）{m.kind === "new" ? 13 : 20}時
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ 各地の活動報告（村ブログ横断フィード）═══ */
export function ActivitySection({ me }: { me: User | null }) {
  const [feed, setFeed] = useState<any[] | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [myVills, setMyVills] = useState<Village[]>([]);
  const [writing, setWriting] = useState(false);
  const [evWriting, setEvWriting] = useState(false); // イベント作成モーダル
  const [wKind, setWKind] = useState<"normal" | "event">("normal");
  const [wEventAt, setWEventAt] = useState("");
  const [joinedEv, setJoinedEv] = useState<Set<string>>(new Set());
  const [wVillage, setWVillage] = useState("");
  const [wBody, setWBody] = useState("");
  const [wPhoto, setWPhoto] = useState<string | null>(null);
  const [wUploading, setWUploading] = useState(false);
  const [wSaving, setWSaving] = useState(false);

  const [cmts, setCmts] = useState<Record<string, VillagePostComment[]>>({});
  const [cOpen, setCOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cSending, setCSending] = useState<string | null>(null);

  const FEED_PAGE = 10;
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [events, setEvents] = useState<any[]>([]); // これからのイベント（横スクロール）
  const [rsvps, setRsvps] = useState<Record<string, any[]>>({}); // post_id -> 参加者profiles

  /** これからのイベント + 参加者を取得 */
  const loadEvents = useCallback(async () => {
    const supabase = createClient();
    const { data: evs } = await supabase
      .from("village_posts")
      .select(
        "id, body, photo_url, kind, event_at, created_at, user_id, villages!village_posts_village_id_fkey(id, name, prefecture), profiles!village_posts_user_id_fkey(username, display_name, avatar_url)"
      )
      .eq("kind", "event")
      .gte("event_at", new Date().toISOString())
      .order("event_at", { ascending: true })
      .limit(12);
    const list = evs ?? [];
    setEvents(list);
    if (list.length) {
      const { data: rs } = await supabase
        .from("event_rsvps")
        .select("post_id, user_id, profiles!event_rsvps_user_id_fkey(username, display_name, avatar_url)")
        .in("post_id", list.map((e: any) => e.id));
      const map: Record<string, any[]> = {};
      for (const r of rs ?? []) (map[r.post_id] = map[r.post_id] ?? []).push(r.profiles);
      setRsvps(map);
      if (me) {
        const mine = new Set((rs ?? []).filter((r: any) => r.user_id === me.id).map((r: any) => r.post_id as string));
        setJoinedEv((prev) => new Set([...prev, ...mine]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Cotozuteの「＋」から来たら、イベント投稿モードで開く
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("write") === "event") {
        setEvWriting(true);
        setWKind("event");
      }
    } catch {}
  }, []);

  const extrasFor = async (posts: any[]) => {
    const map: Record<string, VillagePostComment[]> = {};
    for (const c of await fetchVillagePostComments(posts.map((p) => p.id))) {
      (map[c.post_id] = map[c.post_id] ?? []).push(c);
    }
    setCmts((prev) => ({ ...prev, ...map }));
    try {
      const j = new Set<string>();
      for (const p of posts) if (localStorage.getItem(`onesea-ev-${p.id}`) === "1") j.add(p.id);
      setJoinedEv((prev) => new Set([...prev, ...j]));
    } catch {}
  };

  const loadFeed = useCallback(async () => {
    const f = (await fetchActivityFeed(FEED_PAGE, 0)) as any[];
    setFeed(f);
    setHasMore(f.length === FEED_PAGE);
    await extrasFor(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** もっと見る: さらに10件（その下にまた「もっと見る」） */
  const showMoreFeed = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const more = (await fetchActivityFeed(FEED_PAGE, feed?.length ?? 0)) as any[];
    setFeed((prev) => [...(prev ?? []), ...more]);
    setHasMore(more.length === FEED_PAGE);
    await extrasFor(more);
    setLoadingMore(false);
  };

  const eventLabel = (p: any) =>
    `⛺${p.villages?.name ?? "セカイムラ"}: ${String(p.body ?? "").split("\n")[0].slice(0, 30)}`;

  /** 参加を取り消す → 手帳からその行を消す */
  const cancelEvent = (p: any) => {
    if (!p.event_at) return;
    const d = new Date(p.event_at);
    const key = keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hour = String(d.getHours());
    const label = eventLabel(p);
    try {
      const memos = JSON.parse(localStorage.getItem("techo-memos") ?? "{}");
      const day = memos[key];
      if (day?.h?.[hour]) {
        const lines = String(day.h[hour]).split("\n").filter((l: string) => l !== label);
        if (lines.length) day.h[hour] = lines.join("\n");
        else delete day.h[hour];
        if (!day.note && Object.keys(day.h ?? {}).length === 0) delete memos[key];
        else memos[key] = day;
        localStorage.setItem("techo-memos", JSON.stringify(memos));
      }
      localStorage.removeItem(`onesea-ev-${p.id}`);
    } catch {}
    if (me) {
      const supabase = createClient();
      supabase.from("event_rsvps").delete().eq("post_id", p.id).eq("user_id", me.id).then(() => loadEvents());
    }
    setJoinedEv((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
  };

  /** イベントに参加 → 手帳（メモ帳）のその日時にスケジュールを書き込む */
  const joinEvent = (p: any) => {
    if (!p.event_at) return;
    const d = new Date(p.event_at);
    const key = keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
    try {
      const memos = JSON.parse(localStorage.getItem("techo-memos") ?? "{}");
      const day = memos[key] ?? { note: "", h: {} };
      day.h = day.h ?? {};
      const hour = String(d.getHours());
      const label = eventLabel(p);
      day.h[hour] = day.h[hour] ? `${day.h[hour]}\n${label}` : label; // 2件目以降は改行で追記
      memos[key] = day;
      localStorage.setItem("techo-memos", JSON.stringify(memos));
      localStorage.setItem(`onesea-ev-${p.id}`, "1");
    } catch {}
    if (me) {
      const supabase = createClient();
      supabase.from("event_rsvps").upsert({ post_id: p.id, user_id: me.id }).then(() => loadEvents());
    }
    setJoinedEv((s) => new Set(s).add(p.id));
  };

  const sendCmt = async (postId: string) => {
    const body = (drafts[postId] ?? "").trim();
    if (!me || !body || cSending) return;
    setCSending(postId);
    await addVillagePostComment(postId, me.id, body);
    setDrafts((d) => ({ ...d, [postId]: "" }));
    setCSending(null);
    const list = await fetchVillagePostComments([postId]);
    setCmts((m) => ({ ...m, [postId]: list }));
  };

  useEffect(() => {
    loadFeed();
    fetchVillages(null).then(setVillages);
  }, [loadFeed]);

  useEffect(() => {
    if (!me || villages.length === 0) return;
    myVillageIds(me.id).then((ids) => {
      const mine = villages.filter((v) => ids.has(v.id));
      setMyVills(mine);
      if (mine[0] && !wVillage) setWVillage(mine[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, villages]);

  const publish = async () => {
    if (!me || !wVillage || !wBody.trim() || wSaving) return;
    setWSaving(true);
    const supabase = createClient();
    const eventAt = wKind === "event" && wEventAt ? new Date(wEventAt).toISOString() : null;
    const { data: inserted } = await supabase
      .from("village_posts")
      .insert({
        village_id: wVillage,
        user_id: me.id,
        body: wBody.trim(),
        photo_url: wPhoto,
        kind: wKind,
        event_at: eventAt,
      })
      .select("id")
      .single();
    // 自分で立ち上げたイベントは、参加ボタンなしで自分の手帳に自動登録
    if (eventAt && inserted) {
      joinEvent({
        id: inserted.id,
        event_at: eventAt,
        body: wBody.trim(),
        villages: { name: myVills.find((v) => v.id === wVillage)?.name },
      });
    }
    setWSaving(false);
    setWriting(false);
    setEvWriting(false);
    setWKind("normal");
    setWBody("");
    setWPhoto(null);
    setWEventAt("");
    loadFeed();
    loadEvents();
  };

  return (
    <section
      id="katsudo"
      className="card overflow-hidden"
      style={{ scrollMarginTop: 56, border: "none", padding: 0, background: "#f2f8f0", borderRadius: "18px 18px 0 0" }}
    >
      {/* 見出し（上の角丸でセクションの始まりが分かる） */}
      <div
        className="mb-2 px-4 pb-2.5 pt-3.5"
        style={{ background: "linear-gradient(150deg,#163522,#1e4530)" }}
      >
        <div className="text-[14px] font-extrabold tracking-[2px] text-[#eae6b8]">📣 むらびとたより</div>
        <div className="mt-0.5 text-[10.5px] text-[#8ab89a]">〜 今日、村で何があった？ 〜</div>
      </div>

      {/* 📅 これからのイベント（横スクロール・旧セカイムラ式） */}
      {events.length > 0 && (
        <div className="mb-2">
          <div className="px-3 pb-1 text-[12px] font-extrabold" style={{ color: GREEN }}>
            📅 イベント
          </div>
          <div className="hide-scrollbar flex gap-2.5 overflow-x-auto px-3 pb-1.5">
            {/* 一番左: イベントを投稿するカード */}
            {me && myVills.length > 0 && (
              <button
                onClick={() => {
                  setWKind("event");
                  setEvWriting(true);
                }}
                className="flex w-[76px] flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-white py-4"
                style={{ borderColor: "#4a9a5a" }}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
                  style={{ background: "#4a9a5a" }}
                >
                  ＋
                </span>
                <span className="px-1 text-center text-[10px] font-extrabold leading-snug" style={{ color: GREEN }}>
                  イベントを
                  <br />
                  作成
                </span>
              </button>
            )}
            {events.map((p) => {
              const d = new Date(p.event_at);
              const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][d.getMonth()];
              const title = String(p.body ?? "").split("\n")[0];
              const people = rsvps[p.id] ?? [];
              const joined = joinedEv.has(p.id);
              const dday = Math.ceil((d.getTime() - Date.now()) / 86400000);
              return (
                <div
                  key={p.id}
                  className="w-[230px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#e2eae0] bg-white shadow-sm"
                >
                  <div className="relative h-[110px] bg-[#eaf2ea]">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-[13px] font-extrabold text-white"
                        style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}
                      >
                        ⛺ {p.villages?.name ?? "セカイムラ"}
                      </div>
                    )}
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white"
                      style={{ background: "#4a9a5a" }}
                    >
                      {p.villages?.name ?? "セカイムラ"}
                    </span>
                  </div>
                  <div className="flex gap-2.5 px-2.5 pt-2">
                    <div className="flex-shrink-0 text-center">
                      <div className="text-[10px] font-extrabold leading-none text-[#d04030]">{MON}</div>
                      <div className="num text-[26px] font-extrabold leading-tight text-[#2a3428]">{d.getDate()}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="num text-[13px] font-extrabold text-[#3a4438]">
                        {d.getMonth() + 1}月{d.getDate()}日{d.getHours()}:{String(d.getMinutes()).padStart(2, "0")}〜
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[12.5px] font-extrabold leading-snug" style={{ color: GREEN }}>
                        {title}
                      </div>
                      <div className="num mt-0.5 text-[10px] text-[#a0aca0]">
                        {dday <= 0 ? "今日" : `残り${dday}日`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2.5 pb-2.5 pt-1.5">
                    <div className="flex items-center">
                      {people.slice(0, 5).map((pr: any, i: number) => (
                        <span key={i} style={{ marginLeft: i === 0 ? 0 : -7 }}>
                          <AvatarSm p={pr} size={24} />
                        </span>
                      ))}
                      {people.length > 5 && (
                        <span className="num ml-1 text-[10px] font-bold text-[#8a9a8a]">+{people.length - 5}</span>
                      )}
                      {people.length === 0 && <span className="text-[10px] text-[#b0bcb0]">参加者募集中</span>}
                    </div>
                    {me &&
                      (joined ? (
                        <button
                          onClick={() => cancelEvent(p)}
                          className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
                          style={{ borderColor: "#4a9a5a", color: GREEN, background: "#fff" }}
                        >
                          ✓ 参加中
                        </button>
                      ) : (
                        <button
                          onClick={() => joinEvent(p)}
                          className="rounded-full px-3 py-1.5 text-[11px] font-extrabold text-white"
                          style={{ background: GREEN }}
                        >
                          参加する
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 拠点未所属の人には入口を案内（投稿欄の場所が常に見える） */}
      {me && myVills.length === 0 && (
        <a
          href="/sekai/villages"
          className="mx-2 mb-2 block rounded-2xl border bg-white px-3.5 py-3 text-center text-[12.5px] font-bold no-underline shadow-sm"
          style={{ borderColor: "#c8dccb", color: GREEN }}
        >
          ⛺ 拠点に入ると、ここから「むらびとたより」を投稿できます →
        </a>
      )}

      {/* 活動を報告する（自分の村がある人だけ） */}
      {me && myVills.length > 0 && (
        writing ? (
          <div className="mx-2 mb-2 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
              📣 活動を報告する
            </div>
            {myVills.length > 1 && (
              <select
                value={wVillage}
                onChange={(e) => setWVillage(e.target.value)}
                className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {myVills.map((v) => (
                  <option key={v.id} value={v.id}>
                    ⛺ {v.name}（{v.prefecture}）
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={wBody}
              onChange={(e) => setWBody(e.target.value)}
              rows={2}
              placeholder="例: 今日は田植えをしました / 古民家の床を張り替えました"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 flex items-center gap-2">
              {wPhoto && <img src={wPhoto} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2eae0] bg-white px-3 py-2 text-[12px] font-bold" style={{ color: GREEN }}>
                {wUploading ? "⏳" : <CameraIcon size={16} />}
                写真
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me) return;
                    setWUploading(true);
                    setWPhoto(await uploadImage("post-images", me.id, f, 640, 0.55));
                    setWUploading(false);
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setWriting(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={publish}
                disabled={!wBody.trim() || wSaving || wUploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {wSaving ? "投稿中..." : "📣 全国に報告する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setWKind("normal");
              setWriting(true);
            }}
            className="mx-2 mb-2 block w-[calc(100%-16px)] rounded-2xl border bg-white px-3.5 py-3 text-left shadow-sm"
            style={{ borderColor: "#c8dccb" }}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#eaf4ec] text-[16px]">✍️</span>
              <span className="flex-1 text-[13.5px] text-[#9ab3a0]">今日、村で何があった？</span>
              <span
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white"
                style={{ background: GREEN }}
              >
                投稿
              </span>
            </div>
          </button>
        )
      )}



      {/* 拠点一覧（横スクロールのチップ） */}
      {villages.length > 0 && (
        <div className="hide-scrollbar mb-2 flex gap-1.5 overflow-x-auto px-2">
          {villages.map((v) => (
            <Link
              key={v.id}
              href={`/sekai/village/${v.id}`}
              className="flex-shrink-0 rounded-full border border-[#d8e4da] bg-white px-3 py-1.5 text-[11.5px] font-bold no-underline"
              style={{ color: GREEN }}
            >
              ⛺ {v.name}
              <span className="ml-1 font-normal text-[#a0aca0]">{v.prefecture}</span>
            </Link>
          ))}
        </div>
      )}

      {/* 活動報告フィード */}
      {feed === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : feed.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#4a8a5c44] px-4 py-5 text-center">
          <div className="text-2xl">📣</div>
          <p className="mt-1 text-[12.5px] font-bold" style={{ color: GREEN }}>
            まだ活動報告がありません
          </p>
          <p className="mt-0.5 text-[11px] text-[#a0aca0]">
            「今日は田植えをしました」— あなたの拠点のページから、最初の報告を
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {feed.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-[#e2eae0] bg-white">
              <div className="p-3">
                {/* ヘッダー: 誰（どの拠点）が投稿したか → 本文 → 写真 の順 */}
                <Link
                  href={`/sekai/village/${p.villages?.id}`}
                  className="flex items-center gap-2.5 no-underline"
                >
                  <AvatarSm p={p.profiles} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0 truncate text-[14.5px] font-extrabold" style={{ color: GREEN }}>
                      {p.villages?.name ?? "セカイムラ"}
                      <span className="ml-1 text-[11.5px] font-bold text-[#9ab3a0]">
                        {p.villages?.prefecture ? `@${p.villages.prefecture}` : ""}
                      </span>
                    </div>
                    <div className="num text-[10.5px] text-[#b0bcb0]">
                      {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}
                      {p.profiles?.display_name ? ` ・ ${p.profiles.display_name}` : ""}
                    </div>
                  </div>
                </Link>
                {/* イベント: 日時 + 参加する（押すと自分の手帳に入る） */}
                {p.kind === "event" && p.event_at && (
                  <div
                    className="mt-1.5 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
                    style={{ background: "#fdf6e4", border: "1px solid #e8d8a8" }}
                  >
                    <span className="num min-w-0 text-[12px] font-extrabold text-[#a07820]">
                      📅{" "}
                      {(() => {
                        const d = new Date(p.event_at);
                        return `${d.getMonth() + 1}月${d.getDate()}日（${YOBI[d.getDay()]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}〜`;
                      })()}
                    </span>
                    {me &&
                      (joinedEv.has(p.id) ? (
                        <button
                          onClick={() => cancelEvent(p)}
                          className="flex-shrink-0 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold"
                          style={{ borderColor: "#c8a030", color: "#a07820", background: "#fff" }}
                        >
                          ✓ 参加中（タップで取消）
                        </button>
                      ) : (
                        <button
                          onClick={() => joinEvent(p)}
                          className="flex-shrink-0 rounded-lg px-3 py-1.5 text-[11.5px] font-extrabold text-white"
                          style={{ background: "#c8a030" }}
                        >
                          参加する
                        </button>
                      ))}
                  </div>
                )}
                <p className="mt-2 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#3a4438]">
                  {linkify(String(p.body ?? ""))}
                </p>
                {p.photo_url && (
                  <img src={p.photo_url} alt="" loading="lazy" className="mt-2 max-h-64 rounded-lg object-cover" />
                )}
                {/* コメント（5件まで表示、以降は折りたたみ） */}
                {(() => {
                  const list = cmts[p.id] ?? [];
                  const open = cOpen.has(p.id);
                  const shown = open ? list : list.slice(0, 5);
                  return (
                    <div className="mt-2 border-t border-[#eef2ec] pt-2">
                      {shown.map((c) => (
                        <div key={c.id} className="mb-1.5 flex items-start gap-1.5">
                          <AvatarSm p={c.profiles} size={20} />
                          <div className="min-w-0 flex-1 rounded-lg bg-[#f4f8f2] px-2 py-1">
                            <span className="mr-1.5 text-[10px] font-bold text-[#5a7a5c]">
                              {c.profiles?.display_name ?? "むらびと"}
                            </span>
                            <span className="break-words text-[12px] leading-relaxed text-[#4a4438]">{c.body}</span>
                          </div>
                        </div>
                      ))}
                      {list.length > 5 && (
                        <button
                          onClick={() =>
                            setCOpen((s) => {
                              const n = new Set(s);
                              if (open) n.delete(p.id);
                              else n.add(p.id);
                              return n;
                            })
                          }
                          className="mb-1.5 text-[11px] font-bold underline"
                          style={{ color: GREEN }}
                        >
                          {open ? "たたむ" : `もっと見る（あと${list.length - 5}件）`}
                        </button>
                      )}
                      {me && (
                        <div className="flex items-end gap-1.5">
                          <input
                            value={drafts[p.id] ?? ""}
                            onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                            placeholder="コメントする..."
                            className="min-w-0 flex-1 rounded-full border border-[#e2eae0] bg-white px-3 py-1.5 text-[12.5px] outline-none focus:border-[#4a8a5c]"
                          />
                          <button
                            onClick={() => sendCmt(p.id)}
                            disabled={!(drafts[p.id] ?? "").trim() || cSending === p.id}
                            className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white disabled:opacity-40"
                            style={{ background: "#4a8a5c" }}
                          >
                            送る
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 10件目以降は折りたたみ — もっと見るでさらに10件（その下にまた出る） */}
      {hasMore && (
        <button
          onClick={showMoreFeed}
          disabled={loadingMore}
          className="mt-2 w-full rounded-xl border border-[#d8e4da] bg-white py-2.5 text-[12.5px] font-bold disabled:opacity-50"
          style={{ color: GREEN }}
        >
          {loadingMore ? "読み込み中..." : "▼ もっと見る"}
        </button>
      )}

      {/* 📅 イベント作成モーダル */}
      {evWriting && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45" onClick={() => setEvWriting(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#ddd]" />
            <div className="mb-2 text-[13.5px] font-extrabold" style={{ color: GREEN }}>
              📅 イベントを作成
            </div>
            {myVills.length > 1 && (
              <select
                value={wVillage}
                onChange={(e) => setWVillage(e.target.value)}
                className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {myVills.map((v) => (
                  <option key={v.id} value={v.id}>
                    ⛺ {v.name}（{v.prefecture}）
                  </option>
                ))}
              </select>
            )}
            <input
              type="datetime-local"
              value={wEventAt}
              onChange={(e) => setWEventAt(e.target.value)}
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
            />
            <textarea
              value={wBody}
              onChange={(e) => setWBody(e.target.value)}
              rows={3}
              autoFocus
              placeholder="例: 田植えイベントやります！持ち物は長靴と着替え"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 flex items-center gap-2">
              {wPhoto && <img src={wPhoto} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e2eae0] bg-white px-3 py-2 text-[12px] font-bold" style={{ color: GREEN }}>
                {wUploading ? "⏳" : <CameraIcon size={16} />}
                写真（カードの顔になります）
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me) return;
                    setWUploading(true);
                    setWPhoto(await uploadImage("post-images", me.id, f, 640, 0.55));
                    setWUploading(false);
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEvWriting(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={publish}
                disabled={!wBody.trim() || !wEventAt || wSaving || wUploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {wSaving ? "作成中..." : "📅 イベントを作成する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* おわりの帯（セクションの終わりが一目で分かる） */}
      <div className="mt-2 px-4 py-1.5 text-center" style={{ background: "linear-gradient(150deg,#163522,#1e4530)" }}>
        <span className="text-[9.5px] tracking-[3px] text-[#8ab89a]">〜 むらびとたより ここまで 〜</span>
      </div>
    </section>
  );
}

/* ═══ 顔を知る: 今日の村人 + 新しい村人を迎える ═══ */
export function WelcomeSection({
  me,
  myPref,
  router,
}: {
  me: User | null;
  myPref: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [recent, setRecent] = useState<any[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    recentVillagers(60).then(setRecent);
  }, []);

  const welcome = async (p: any) => {
    if (!me || sent.has(p.id) || me.id === p.id) return;
    setSent((prev) => new Set(prev).add(p.id));
    const chatId = await getOrCreateChat(me.id, p.id);
    if (chatId) {
      await sendMessage(chatId, me.id, "ようこそセカイムラへ 🌱 全国に、血のつながらない家族がいます。私もそのひとりです。");
      router.push(`/line/${chatId}`);
    }
  };

  // 自分と同じ県の新入り村人だけ
  const samePref = recent.filter((p) => p.prefecture === myPref);
  if (samePref.length === 0) return null;

  return (
    <section className="card">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🔰 私の県の新しい村人
        </span>
        <span className="text-[10px] text-[#a0aca0]">入った人を、ひとりにしない</span>
      </div>
      <div className="hide-scrollbar flex gap-2 overflow-x-auto px-2">
        {samePref.map((p) => (
          <div
            key={p.id}
            className="w-32 flex-shrink-0 rounded-xl border border-[#e2eae0] bg-white p-2.5 text-center"
          >
            <div className="flex justify-center">
              <AvatarSm p={p} size={44} />
            </div>
            <div className="mt-1.5 truncate text-xs font-bold text-[#3a3428]">{p.display_name ?? "むらびと"}</div>
            <div className="truncate text-[9.5px] text-[#a0aca0]">{p.prefecture ?? ""}</div>
            {me && me.id !== p.id && (
              <button
                onClick={() => welcome(p)}
                disabled={sent.has(p.id)}
                className="mt-1.5 w-full rounded-lg py-1.5 text-[10.5px] font-bold text-white disabled:opacity-50"
                style={{ background: "#4a8a5c" }}
              >
                {sent.has(p.id) ? "送りました 🌿" : "ようこそを送る"}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══ ラウンジ喫茶（常時オープンのビデオ通話）入口 ═══ */
/** ラウンジ喫茶の地域一覧（47都道府県 + 48番目に海外） */
const CAFE_AREAS = [...PREFS, "海外"] as const;

export function CafeBar({ pref }: { pref: string }) {
  const [sel, setSel] = useState<string>(pref);
  const [count, setCount] = useState(0);

  useEffect(() => setSel(pref), [pref]);

  useEffect(() => {
    const supabase = createClient();
    // 見るだけ（track しない）ので在室者にはカウントされない
    const ch = supabase.channel(`cafe:${sel}`);
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, Array<{ t?: number }>>;
      setCount(Object.keys(st).filter((k) => st[k][0]?.t !== undefined).length);
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [sel]);

  return (
    <div
      className="mb-3 rounded-xl px-3.5 py-3"
      style={{ background: "linear-gradient(135deg,#241c14,#3a2e1e)", border: "1px solid #c8a86055" }}
    >
      <div className="flex items-center gap-3">
        <span className="text-[30px]">☕</span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold text-[#f0e2c8]">村人ラウンジ喫茶 〜常時オープン〜</div>
          <div className="mt-0.5 text-[10.5px] text-[#a89878]">
            {count > 0 ? (
              <span className="font-bold text-[#8ad8a8]">
                <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#5ad890] align-middle" />
                いま {count}人がお店にいます — 顔を見て話せます
              </span>
            ) : (
              "いまは誰もいません。一番乗りでお茶をどうぞ"
            )}
          </div>
        </div>
        <Link
          href={`/sekai/cafe/${encodeURIComponent(sel)}`}
          className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-extrabold text-[#241c14] no-underline"
          style={{ background: "linear-gradient(135deg,#e8cc90,#c8a860)" }}
        >
          入店する
        </Link>
      </div>
      {/* 店内の雰囲気（村人待合室） */}
      <Link href={`/sekai/cafe/${encodeURIComponent(sel)}`} className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sekai/cafe-photo.webp"
          alt="村人ラウンジ喫茶"
          className="mt-2.5 w-full rounded-lg object-cover"
          style={{ maxHeight: 110, objectPosition: "center 60%" }}
        />
      </Link>
      {/* 地域を選ぶ（47都道府県 + 海外） */}
      <select
        value={sel}
        onChange={(e) => setSel(e.target.value)}
        className="mt-2.5 w-full rounded-lg border border-[#c8a86044] bg-[#1a140e] px-3 py-2 text-[12.5px] text-[#e8d5a8] outline-none"
      >
        {CAFE_AREAS.map((p) => (
          <option key={p} value={p}>
            {p}
            {p === pref ? "（わたしの地域）" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ═══ 地域ラウンジ + 旅先モード ═══ */
export function LoungeSection({
  me,
  myPref,
  router,
}: {
  me: User | null;
  myPref: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [pref, setPref] = useState(myPref);
  const [travelMode, setTravelMode] = useState(false);
  useEffect(() => {
    setPref(myPref);
    setTravelMode(false);
  }, [myPref]);
  const onPref = (p: string, travel: boolean) => {
    setPref(p);
    setTravelMode(travel);
  };
  const [posts, setPosts] = useState<any[] | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [ps, vs] = await Promise.all([fetchLounge(pref), villagersOf(pref)]);
    setPosts(ps as any[]);
    setPeople(vs as any[]);
  }, [pref]);

  useEffect(() => {
    setPosts(null);
    load();
  }, [load]);

  const submit = async () => {
    if (!me || !body.trim() || sending) return;
    setSending(true);
    await postLounge(me.id, pref, body.trim());
    setBody("");
    setSending(false);
    load();
  };

  return (
    <section id="lounge" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🗣 {pref}ラウンジ
        </span>
        {travelMode && (
          <span className="rounded-full bg-[#fdf0e0] px-2 py-0.5 text-[10px] font-bold text-[#c08030]">
            🧳 旅先モード
          </span>
        )}
      </div>

      {/* 喫茶店（常時オープンのビデオ通話） */}
      <CafeBar pref={pref} />

      {/* 県セレクタ = 旅先モード */}
      <div className="mb-2.5 flex items-center gap-2">
        <select
          value={pref}
          onChange={(e) => onPref(e.target.value, e.target.value !== myPref)}
          className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
        >
          {PREFS.map((p) => (
            <option key={p} value={p}>
              {p}
              {p === myPref ? "（わたしの地域）" : ""}
            </option>
          ))}
        </select>
        {travelMode && (
          <button
            onClick={() => onPref(myPref, false)}
            className="flex-shrink-0 rounded-xl border border-[#d8e4da] px-3 py-2 text-[11.5px] font-bold"
            style={{ color: GREEN }}
          >
            地元へ戻る
          </button>
        )}
      </div>

      {/* この地域の村人 */}
      {people.length > 0 && (
        <div className="mb-2.5">
          <div className="mb-1 text-[10.5px] text-[#a0aca0]">{pref}の村人 {people.length}人</div>
          <div className="hide-scrollbar flex gap-1.5 overflow-x-auto">
            {people.map((p) => (
              <AvatarSm key={p.id} p={p} size={38} />
            ))}
          </div>
        </div>
      )}

      {/* 投稿 */}
      {me && (
        <div className="mb-2 flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={travelMode ? `${pref}のみなさん、こんにちは。近々そちらへ…` : "この地域のみんなに、ひとこと"}
            rows={1}
            className="min-h-[40px] flex-1 resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13.5px] outline-none focus:border-[#4a8a5c]"
          />
          <button
            onClick={submit}
            disabled={!body.trim() || sending}
            className="flex-shrink-0 rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-40"
            style={{ background: "#4a8a5c" }}
          >
            投稿
          </button>
        </div>
      )}

      {posts === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-2 text-[12.5px] leading-relaxed text-[#a0aca0]">
          まだ誰も書いていません。最初のひとことが、この地域の火種になります 🔥
        </p>
      ) : (
        posts.map((p) => (
          <div key={p.id} className="flex gap-2.5 border-b border-[#eef2ec] py-2">
            <AvatarSm p={p.profiles} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <span className="text-[12px] font-bold text-[#3a3428]">
                  {p.profiles?.display_name ?? "むらびと"}
                </span>
                <span className="num text-[10px] text-[#c0c8c0]">
                  {new Date(p.created_at).getMonth() + 1}/{new Date(p.created_at).getDate()}
                </span>
              </div>
              <p className="break-words text-[13px] leading-relaxed text-[#5a5448]">{p.body}</p>
              {me && me.id !== p.user_id && p.profiles?.username && (
                <button
                  onClick={async () => {
                    const chatId = await getOrCreateChat(me.id, p.user_id);
                    if (chatId) router.push(`/line/${chatId}`);
                  }}
                  className="mt-0.5 text-[10.5px] font-bold underline"
                  style={{ color: GREEN }}
                >
                  話しかける
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/* ═══ 拠点（村）+ 村をつくる ═══ */
export function VillagesSection({
  me,
  myPref,
  router,
}: {
  me: User | null;
  myPref: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [pref, setPref] = useState(myPref);
  useEffect(() => setPref(myPref), [myPref]);
  const [villages, setVillages] = useState<Village[] | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [vCity, setVCity] = useState("");
  const [policy, setPolicy] = useState<Village["policy"]>("open");
  const [saving, setSaving] = useState(false);
  const [born, setBorn] = useState<string | null>(null);

  const isJapan = (PREFS as readonly string[]).includes(pref);
  useEffect(() => setVCity(""), [pref]);

  const load = useCallback(async () => {
    const list = await fetchVillages(null);
    setVillages(list);
    if (me) setMineIds(await myVillageIds(me.id));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const officials = (villages ?? []).filter((v) => v.is_official);
  const inPref = (villages ?? []).filter((v) => !v.is_official && v.prefecture === pref);
  const others = (villages ?? []).filter((v) => !v.is_official && v.prefecture !== pref);

  const create = async () => {
    if (!me || !name.trim() || saving) return;
    setSaving(true);
    await createVillage(me.id, {
      name: name.trim(),
      prefecture: pref,
      city: isJapan && vCity ? vCity : null,
      description: desc.trim(),
      policy,
    });
    setSaving(false);
    setCreating(false);
    setBorn(name.trim());
    setName("");
    setDesc("");
    load();
    setTimeout(() => setBorn(null), 6000);
  };

  const VillageCard = ({ v }: { v: Village }) => {
    const members = v.village_members?.[0]?.count ?? 0;
    const joined = mineIds.has(v.id);
    return (
      <div className="rounded-xl border border-[#e2eae0] bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/sekai/village/${v.id}`} className="min-w-0 no-underline">
            <div className="text-[14.5px] font-extrabold text-[#2a4a34]">⛺ {v.name} <span className="text-[10px] text-[#a0aca0]">›</span></div>
            <div className="mt-0.5 text-[11px] text-[#a0aca0]">
              {v.prefecture}
              {v.city ? ` ${v.city}` : ""} ・ {members}人 ・ 世話人 {v.profiles?.display_name ?? "—"}
            </div>
          </Link>
          <span className="flex flex-shrink-0 items-center gap-1">
            {v.is_official && (
              <span
                className="rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
                style={{ background: "#f8f0d8", color: "#a08030", border: "1px solid #d4b96a" }}
              >
                🏛 公式
              </span>
            )}
            <span
              className="rounded-full px-2 py-0.5 text-[9.5px] font-bold"
              style={
                v.policy === "open"
                  ? { background: "#eaf6ee", color: GREEN }
                  : { background: "#f4f0e6", color: "#a08030" }
              }
            >
              {POLICY_LABEL[v.policy]}
            </span>
          </span>
        </div>
        {v.description && <p className="mt-1 text-[12px] leading-relaxed text-[#5a6458]">{v.description}</p>}
        {me && !joined && (
          <div className="mt-2">
            {v.policy === "open" ? (
              <button
                onClick={async () => {
                  await joinVillage(me.id, v.id);
                  load();
                }}
                className="rounded-lg px-4 py-1.5 text-[12px] font-extrabold text-white"
                style={{ background: "#4a8a5c" }}
              >
                この村に入る
              </button>
            ) : v.policy === "approval" || v.policy === "invite" ? (
              <button
                onClick={async () => {
                  if (!v.created_by) return;
                  const chatId = await getOrCreateChat(me.id, v.created_by);
                  if (chatId) router.push(`/line/${chatId}`);
                }}
                className="rounded-lg border border-[#d8e4da] px-4 py-1.5 text-[12px] font-bold"
                style={{ color: GREEN }}
              >
                立ち上げ村長に連絡する
              </button>
            ) : (
              <span className="text-[11px] text-[#a0aca0]">いまは募集していません — 別の村か、新しい村を</span>
            )}
          </div>
        )}
        {joined && <div className="mt-1.5 text-[11px] font-bold" style={{ color: GREEN }}>✓ あなたの村</div>}
      </div>
    );
  };

  return (
    <section id="villages" className="card" style={{ scrollMarginTop: 56 }}>
      {/* 公式拠点（事務局認定・全国） */}
      {officials.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: "#a08030" }}>
              🏛 セカイムラ公式拠点
            </span>
            <span className="text-[10px] text-[#a0aca0]">セカイムラ事務局が認定</span>
          </div>
          <div className="space-y-2">
            {officials.map((v) => (
              <VillageCard key={v.id} v={v} />
            ))}
          </div>
        </div>
      )}

      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          ⛺ {pref}の拠点
        </span>
        <span className="text-[10px] text-[#a0aca0]">一つの県に、いくつでも</span>
      </div>
      <select
        value={pref}
        onChange={(e) => setPref(e.target.value)}
        className="mb-2.5 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
      >
        <optgroup label="日本（47都道府県）">
          {PREFS.map((p) => (
            <option key={p} value={p}>
              {p}
              {p === myPref ? "（わたしの地域）" : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="海外">
          {OVERSEAS_AREAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </optgroup>
      </select>

      {born && (
        <div
          className="mb-2.5 rounded-xl px-4 py-3 text-center"
          style={{ background: "linear-gradient(135deg,#eaf6ee,#fdf8ec)", border: "1.5px solid #4a8a5c66" }}
        >
          <div className="text-[22px]">🎉🔥🎉</div>
          <div className="mt-0.5 text-[14px] font-extrabold" style={{ color: GREEN }}>
            「{born}」が生まれました
          </div>
          <div className="mt-0.5 text-[11px] text-[#8a968a]">あなたが世話人です。地図にも灯りました</div>
        </div>
      )}
      {villages === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : inPref.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed px-4 py-5 text-center"
          style={{ borderColor: "#4a8a5c55", background: "linear-gradient(135deg,#eff7f0,#fffdf8)" }}
        >
          <div className="text-3xl">⛺</div>
          <p className="mt-1.5 text-[13.5px] font-extrabold" style={{ color: GREEN }}>
            {pref}には、まだ拠点がありません
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#8a968a]">最初の拠点を、あなたが立ち上げませんか</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inPref.map((v) => (
            <VillageCard key={v.id} v={v} />
          ))}
        </div>
      )}

      {/* 村をつくるボタン */}
      {me &&
        (creating ? (
          <div className="mt-3 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
              拠点を立ち上げる
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`例: セカイムラ${pref.replace(/[都道府県]$/, "")}${inPref.length > 0 ? inPref.length + 1 : ""}`}
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 text-[10.5px] text-[#8a968a]">
              場所: <b className="text-[#3a5a44]">{pref}</b>（上の選択と連動）
            </div>
            {/* 日本の県なら市区町村（総務省の全国市区町村）を選べる。海外は不要 */}
            {isJapan && (
              <select
                value={vCity}
                onChange={(e) => setVCity(e.target.value)}
                className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                <option value="">市区町村を選ぶ *</option>
                {(JP_CITIES[pref] ?? []).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value as Village["policy"])}
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
            >
              <option value="open">誰でも参加OK</option>
              <option value="approval">申請・承認制</option>
              <option value="invite">招待制</option>
            </select>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={2}
              placeholder="どんな集まりにしたい？（例: 駅近マンションを満月・新月に開放。ごはん持ち寄り）"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:border-[#4a8a5c]"
            />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={create}
                disabled={!name.trim() || (isJapan && !vCity) || saving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {saving ? "立ち上げています..." : "拠点を立ち上げる"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#a0aca0]">
              あなたが世話人になります。場所の形は自由 — 自宅の開放も、ドネーション制も、古民家も。
            </p>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="mt-3 w-full rounded-xl py-3 text-[14px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg,#4a8a5c,#3a7a4c)" }}
          >
            ⛺ 拠点を立ち上げる
          </button>
        ))}

      {/* 全国の拠点（折りたたみ表示） */}
      {others.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-[11.5px] font-bold" style={{ color: GREEN }}>
            全国の拠点をみる（{others.length}）
          </summary>
          <div className="mt-2 space-y-2">
            {others.map((v) => (
              <VillageCard key={v.id} v={v} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

/* ═══ 部活動 ═══ */
export function ClubsSection({ me }: { me: User | null }) {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🌱");
  const [desc, setDesc] = useState("");
  const [scope, setScope] = useState("全国");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setClubs(await fetchClubs());
    if (me) setMineIds(await myClubIds(me.id));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!me || !name.trim() || saving) return;
    setSaving(true);
    await createClub(me.id, { name: name.trim(), emoji, description: desc.trim(), scope });
    setSaving(false);
    setCreating(false);
    setName("");
    setDesc("");
    load();
  };

  return (
    <section id="clubs" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🎌 部活動
        </span>
        <span className="text-[10px] text-[#a0aca0]">会話が苦手でも、手を動かせばつながれる</span>
      </div>

      {clubs === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* 米部は独立ページに昇格したので部活一覧からは外す */}
          {clubs.filter((c) => !(c.is_official && c.name.includes("米"))).map((c) => {
            const members = c.club_members?.[0]?.count ?? 0;
            const joined = mineIds.has(c.id);
            return (
              <Link
                key={c.id}
                href={`/sekai/club/${c.id}`}
                className="rounded-xl border bg-white p-3 no-underline"
                style={{ borderColor: c.is_official ? "#d4b96a88" : "#e2eae0" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[22px]">{c.emoji ?? "🎌"}</span>
                  {c.is_official && (
                    <span className="rounded-full bg-[#f8f2e0] px-1.5 py-0.5 text-[8.5px] font-bold text-[#a08030]">
                      公式
                    </span>
                  )}
                </div>
                <div className="mt-1 line-clamp-1 text-[13px] font-extrabold text-[#2a4a34]">{c.name}</div>
                <div className="mt-0.5 text-[10px] text-[#a0aca0]">
                  {c.scope} ・ {members}人{joined ? " ・ ✓ 入部中" : ""}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {me &&
        (creating ? (
          <div className="mt-3 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
              あなたが部長 — 部活をつくる
            </div>
            <div className="mb-2 flex gap-2">
              <input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-14 rounded-xl border border-[#e2eae0] bg-white px-2 py-2.5 text-center text-[16px] outline-none"
                maxLength={2}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 養蜂部 / 木綿から糸を作る部 / 味噌部"
                className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#4a8a5c]"
              />
            </div>
            <div className="mb-2 flex gap-2">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                <option>全国</option>
                {PREFS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="ひとことで何をする部？"
                className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#4a8a5c]"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={create}
                disabled={!name.trim() || saving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {saving ? "旗を立てています..." : "🚩 この部の旗を立てる"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#4a8a5c66", color: GREEN }}
          >
            🚩 部活をつくる
          </button>
        ))}
    </section>
  );
}

/* ═══ 米部 ═══ */
export function KomeSection({ me, myPref }: { me: User | null; myPref: string }) {
  const [tanbo, setTanbo] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [tPref, setTPref] = useState(myPref);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setTPref(myPref), [myPref]);
  const load = useCallback(async () => setTanbo(await fetchTanbo()), []);
  useEffect(() => {
    load();
  }, [load]);

  const thisYear = (tanbo ?? []).filter((t) => t.year === new Date().getFullYear()).length;

  const save = async () => {
    if (!me || !name.trim() || saving) return;
    setSaving(true);
    await addTanbo(me.id, { name: name.trim(), prefecture: tPref, note: note.trim(), photo_url: photo });
    setSaving(false);
    setAdding(false);
    setName("");
    setNote("");
    setPhoto(null);
    load();
  };

  return (
    <section id="kome" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🌾 セカイムラ米部
        </span>
        <span className="num text-[10px] text-[#a0aca0]">2025年 全国75枚の田んぼを蘇らせた</span>
      </div>

      <div className="mb-2.5 flex items-end justify-center gap-8 rounded-xl bg-[#f7f4ea] py-3 text-center">
        <div>
          <div className="num text-[26px] font-extrabold leading-none text-[#8a7020]">{thisYear}</div>
          <div className="mt-1 text-[9.5px] tracking-[2px] text-[#a09060]">今年の田んぼ</div>
        </div>
        <div>
          <div className="num text-[26px] font-extrabold leading-none text-[#8a7020]">75</div>
          <div className="mt-1 text-[9.5px] tracking-[2px] text-[#a09060]">2025年の実績</div>
        </div>
      </div>

      {tanbo !== null && tanbo.length > 0 && (
        <div className="space-y-2">
          {tanbo.slice(0, 6).map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-[#eef2ec] bg-white p-2">
              {t.photo_url ? (
                <img src={t.photo_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#f2f4ea] text-xl">
                  🌾
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[#3a4a34]">{t.name}</div>
                <div className="text-[10.5px] text-[#a0aca0]">
                  {t.prefecture} ・ {t.profiles?.display_name ?? ""}
                </div>
                {t.note && <div className="truncate text-[11px] text-[#8a968a]">{t.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {me &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-[#c8b86a88] bg-[#fbf9f0] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#8a7020]">🌾 田んぼを台帳に載せる</div>
            <div className="mb-2 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: ◯◯さんちの棚田"
                className="min-w-0 flex-1 rounded-xl border border-[#e8e2cc] bg-white px-3 py-2.5 text-[14px] outline-none"
              />
              <select
                value={tPref}
                onChange={(e) => setTPref(e.target.value)}
                className="rounded-xl border border-[#e8e2cc] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {PREFS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ひとこと（例: 5年放棄→今年田植え！）"
              className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[13px] outline-none"
            />
            <div className="mb-2 flex items-center gap-2">
              {photo && <img src={photo} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8e2cc] bg-white px-3 py-2 text-[12px] font-bold text-[#8a7020]">
                {uploading ? "⏳" : <CameraIcon size={16} />}
                写真
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me) return;
                    setUploading(true);
                    setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55));
                    setUploading(false);
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={save}
                disabled={!name.trim() || saving || uploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#a08a30" }}
              >
                {saving ? "登録中..." : "台帳に載せる"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#c8b86a88", color: "#8a7020" }}
          >
            🌾 蘇らせた田んぼを登録する
          </button>
        ))}
    </section>
  );
}

/* ═══ 神社町 ═══ */
export function JinjaSection({ me, myPref }: { me: User | null; myPref: string }) {
  const [misoka] = useState(() => nextMisoka());
  const [reports, setReports] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [shrine, setShrine] = useState("");
  const [jPref, setJPref] = useState(myPref);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setJPref(myPref), [myPref]);
  const load = useCallback(async () => setReports(await fetchJinja()), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!me || !shrine.trim() || saving) return;
    setSaving(true);
    await addJinja(me.id, { shrine: shrine.trim(), prefecture: jPref, note: note.trim(), photo_url: photo });
    setSaving(false);
    setAdding(false);
    setShrine("");
    setNote("");
    setPhoto(null);
    load();
  };

  return (
    <section id="jinja" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          ⛩ セカイムラ神社町
        </span>
        <span className="text-[10px] text-[#a0aca0]">ミソカの日、近所の神社をそうじする</span>
      </div>

      <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-[#f4f0e8] px-3.5 py-2.5">
        <span className="text-[26px]">🧹</span>
        <div>
          <div className="text-[10.5px] tracking-wider text-[#a09060]">次のミソカ（晦日）</div>
          <div className="num text-[17px] font-extrabold leading-snug text-[#6a5a20]">
            {misoka.label}
            <span className="ml-2 text-[12px] font-bold text-[#a09060]">
              {misoka.dday === 0 ? "今日！" : misoka.dday === 1 ? "明日" : `あと${misoka.dday}日`}
            </span>
          </div>
        </div>
      </div>

      {reports !== null && reports.length > 0 && (
        <div className="space-y-2">
          {reports.slice(0, 5).map((r) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-xl border border-[#eef2ec] bg-white p-2">
              {r.photo_url ? (
                <img src={r.photo_url} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#f4f0e8] text-xl">
                  ⛩
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[#3a4a34]">{r.shrine}</div>
                <div className="text-[10.5px] text-[#a0aca0]">
                  {r.prefecture ?? ""} ・ {r.profiles?.display_name ?? ""}
                </div>
                {r.note && <div className="truncate text-[11px] text-[#8a968a]">{r.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {me &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-[#c8b86a88] bg-[#fbf9f0] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#8a7020]">⛩ そうじの奉告</div>
            <div className="mb-2 flex gap-2">
              <input
                value={shrine}
                onChange={(e) => setShrine(e.target.value)}
                placeholder="神社の名前"
                className="min-w-0 flex-1 rounded-xl border border-[#e8e2cc] bg-white px-3 py-2.5 text-[14px] outline-none"
              />
              <select
                value={jPref}
                onChange={(e) => setJPref(e.target.value)}
                className="rounded-xl border border-[#e8e2cc] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {PREFS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ひとこと（例: 落ち葉と鳥居を拭きました）"
              className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[13px] outline-none"
            />
            <div className="mb-2 flex items-center gap-2">
              {photo && <img src={photo} alt="" className="h-14 w-14 rounded-lg object-cover" />}
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8e2cc] bg-white px-3 py-2 text-[12px] font-bold text-[#8a7020]">
                {uploading ? "⏳" : <CameraIcon size={16} />}
                写真
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !me) return;
                    setUploading(true);
                    setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55));
                    setUploading(false);
                  }}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={save}
                disabled={!shrine.trim() || saving || uploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#a08a30" }}
              >
                {saving ? "奉告中..." : "奉告する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#c8b86a88", color: "#8a7020" }}
          >
            🧹 そうじを奉告する
          </button>
        ))}
    </section>
  );
}

/* ═══ 百姓マイスター ═══ */
export function MeisterSection({ me }: { me: User | null }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchMeister>> | null>(null);
  const [openSkill, setOpenSkill] = useState<number | null>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => setData(await fetchMeister(me?.id ?? null)), [me]);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (openSkill !== null) meisterTeachers(openSkill).then(setTeachers);
  }, [openSkill]);

  const myCount = data?.mineCan.size ?? 0;
  const skills = showAll ? MEISTER_SKILLS : MEISTER_SKILLS.slice(0, 24);

  return (
    <section id="meister" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🫙 百姓マイスター
        </span>
        <span className="text-[10px] text-[#a0aca0]">百の仕事ができる人へ</span>
      </div>

      {/* マイスター講座（動画はこれから追加） */}
      <div className="mb-3 space-y-1.5">
        {MEISTER_COURSES.map((c) => (
          <details key={c.id} className="overflow-hidden rounded-xl border border-[#e2eae0] bg-white">
            <summary className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5">
              <span className="text-[20px]">{c.emoji}</span>
              <span className="min-w-0 flex-1 text-[13px] font-extrabold text-[#2a4a34]">{c.title}</span>
              <span className="num flex-shrink-0 text-[10px] text-[#a0aca0]">
                {c.videos.length > 0 ? `${c.videos.length}本` : "準備中"}
              </span>
              <span className="flex-shrink-0 text-[10px] text-[#a0aca0]">▾</span>
            </summary>
            <div className="border-t border-[#eef2ec] px-3 py-2">
              {c.videos.length === 0 ? (
                <p className="py-1 text-[11.5px] text-[#a0aca0]">講座動画は、これからここに増えていきます 🌱</p>
              ) : (
                <div className="space-y-1">
                  {c.videos.map((v, i) => (
                    <a
                      key={i}
                      href={v.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 no-underline active:bg-[#f4f8f0]"
                    >
                      <span className="flex h-6 w-9 flex-shrink-0 items-center justify-center rounded bg-[#f00] text-[9px] font-extrabold text-white">
                        ▶
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[#3a4438]">{v.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>

      {me && (
        <div className="mb-3 rounded-xl bg-[#f2f6ee] px-3.5 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold text-[#5a7a4c]">あなたのマイスター度</span>
            <span className="num text-[17px] font-extrabold text-[#3a6a2c]">
              {myCount}<span className="text-[11px] font-bold text-[#8aa87c]">/100</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#dde8d4]">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${myCount}%`, background: "linear-gradient(90deg,#7ba05b,#4a8a5c)" }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {skills.map((skill, i) => {
          const can = data?.can.get(i) ?? 0;
          const mine = data?.mineCan.has(i);
          const wantMine = data?.mineWant.has(i);
          const open = openSkill === i;
          return (
            <button
              key={i}
              onClick={() => setOpenSkill(open ? null : i)}
              className="rounded-full border px-2.5 py-1.5 text-[11.5px] font-medium"
              style={
                mine
                  ? { background: "#4a8a5c", color: "#fff", borderColor: "#4a8a5c" }
                  : wantMine
                    ? { background: "#fdf4e0", color: "#a07020", borderColor: "#e0cc90" }
                    : open
                      ? { background: "#eef6f0", color: GREEN, borderColor: "#4a8a5c" }
                      : { background: "#fff", color: "#5a6458", borderColor: "#e2eae0" }
              }
            >
              {skill}
              {can > 0 && <span className="num ml-1 text-[9.5px] opacity-80">{can}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={() => setShowAll(!showAll)} className="mt-2 text-[11.5px] font-bold underline" style={{ color: GREEN }}>
        {showAll ? "たたむ" : `100の技をすべて見る`}
      </button>

      {openSkill !== null && (
        <div className="mt-2.5 rounded-xl border border-[#e2eae0] bg-[#fafcf8] p-3">
          <div className="text-[13px] font-extrabold text-[#2a4a34]">{MEISTER_SKILLS[openSkill]}</div>
          {me && data && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={async () => {
                  await toggleMeister(me.id, openSkill, "can", data.mineCan.has(openSkill));
                  load();
                }}
                className="flex-1 rounded-xl border py-2 text-[12.5px] font-extrabold"
                style={
                  data.mineCan.has(openSkill)
                    ? { background: "#4a8a5c", color: "#fff", borderColor: "#4a8a5c" }
                    : { background: "#fff", color: GREEN, borderColor: "#4a8a5c" }
                }
              >
                {data.mineCan.has(openSkill) ? "✓ できる" : "できる！"}
              </button>
              <button
                onClick={async () => {
                  await toggleMeister(me.id, openSkill, "want", data.mineWant.has(openSkill));
                  load();
                }}
                className="flex-1 rounded-xl border py-2 text-[12.5px] font-extrabold"
                style={
                  data.mineWant.has(openSkill)
                    ? { background: "#c8a030", color: "#fff", borderColor: "#c8a030" }
                    : { background: "#fff", color: "#a07020", borderColor: "#e0cc90" }
                }
              >
                {data.mineWant.has(openSkill) ? "✓ 学びたい" : "学びたい"}
              </button>
            </div>
          )}
          {teachers.length > 0 && (
            <div className="mt-2.5">
              <div className="mb-1 text-[10.5px] text-[#a0aca0]">教えてくれるかもしれない村人</div>
              <div className="flex gap-1.5">
                {teachers.map((t, i) => (
                  <AvatarSm key={i} p={t} size={36} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ═══ 助けて掲示板 ═══ */
export function TasuketeSection({ me, myPref, router }: { me: User | null; myPref: string; router: ReturnType<typeof useRouter> }) {
  const [posts, setPosts] = useState<any[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tPref, setTPref] = useState(myPref);
  const [reward, setReward] = useState("無償");
  const [saving, setSaving] = useState(false);

  useEffect(() => setTPref(myPref), [myPref]);
  const load = useCallback(async () => setPosts(await fetchTasukete()), []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!me || !title.trim() || saving) return;
    setSaving(true);
    await addTasukete(me.id, { title: title.trim(), body: body.trim(), prefecture: tPref, reward });
    setSaving(false);
    setAdding(false);
    setTitle("");
    setBody("");
    load();
  };

  return (
    <section id="tasukete" className="card" style={{ scrollMarginTop: 56 }}>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🤝 助けて掲示板
        </span>
        <span className="text-[10px] text-[#a0aca0]">「助けて」と言えるのが、家族</span>
      </div>

      {posts === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : posts.length === 0 ? (
        <p className="py-2 text-[12.5px] text-[#a0aca0]">いまは助けての声はありません</p>
      ) : (
        <div className="space-y-2">
          {posts.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#eef2ec] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13.5px] font-extrabold leading-snug text-[#3a4a34]">{t.title}</div>
                <span className="flex-shrink-0 rounded-full bg-[#eef6f0] px-2 py-0.5 text-[9.5px] font-bold" style={{ color: GREEN }}>
                  {t.reward}
                </span>
              </div>
              {t.body && <p className="mt-1 text-[12px] leading-relaxed text-[#5a6458]">{t.body}</p>}
              <div className="mt-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AvatarSm p={t.profiles} size={24} />
                  <span className="text-[10.5px] text-[#a0aca0]">
                    {t.profiles?.display_name ?? ""} ・ {t.prefecture ?? ""}
                  </span>
                </div>
                {me && me.id !== t.user_id ? (
                  <button
                    onClick={async () => {
                      const chatId = await getOrCreateChat(me.id, t.user_id);
                      if (chatId) {
                        await sendMessage(chatId, me.id, `「${t.title}」— 助けます 🤝`);
                        router.push(`/line/${chatId}`);
                      }
                    }}
                    className="rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold text-white"
                    style={{ background: "#4a8a5c" }}
                  >
                    助けます
                  </button>
                ) : me && me.id === t.user_id ? (
                  <button
                    onClick={async () => {
                      await closeTasukete(me.id, t.id);
                      load();
                    }}
                    className="text-[11px] text-[#a0aca0] underline"
                  >
                    解決した
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {me &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 田植えを手伝ってほしい / 工具を貸してほしい"
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#4a8a5c]"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={2}
              placeholder="いつ・どこで・どれくらい"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
            />
            <div className="mb-2 flex gap-2">
              <select
                value={tPref}
                onChange={(e) => setTPref(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {PREFS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className="rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                <option>無償</option>
                <option>実費</option>
                <option>持ち寄り</option>
                <option>助け返し</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                やめる
              </button>
              <button
                onClick={save}
                disabled={!title.trim() || saving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {saving ? "投稿中..." : "助けてを出す"}
              </button>
            </div>
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-[#b0bcb0]">
              ※お金の貸し借り・医療介護・子どもの預かりはここでは扱いません。有償の専門サービスは楽市楽座へ。
            </p>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#4a8a5c66", color: GREEN }}
          >
            🤝 助けてを出す
          </button>
        ))}
    </section>
  );
}

/* ═══ 地図（拠点データを渡すローダー） ═══ */
export function MapLoader() {
  const [villages, setVillages] = useState<Village[] | null>(null);
  useEffect(() => {
    fetchVillages(null).then(setVillages);
  }, []);
  if (villages === null) return <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>;
  return <SekaiMap villages={villages} />;
}
