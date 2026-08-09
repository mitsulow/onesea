"use client";

import { EmbedCard } from "@/components/EmbedCard";
import { PlaceOverlay, type PlaceInfo } from "@/components/PlaceOverlay";
import { readTecho, writeTecho } from "@/lib/techoStore";
import { SekaiBadge } from "@/components/WarawaBadge";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThreeCol } from "@/components/SideRails";
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
  setRsvp,
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
  closeTasukete, PREF_COORDS } from "@/lib/sekai";
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
import TopTone from "@/components/TopTone";
import { moonsOfYear, YOBI, keyOf } from "@/lib/almanac";
import { MEISTER_COURSES } from "@/data/meister-courses";
import { LATEST_MOOT_VIDEO, PAST_MOOT_VIDEOS } from "@/data/moot-videos";
import { srcCdn } from "@/lib/images";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const GREEN = "#3a7a4c";
const DARKGREEN_BG = "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)";

export function AvatarSm({ p, size = 34 }: { p: any; size?: number }) {
  const inner = p?.avatar_url ? (
    <img
      src={srcCdn(p.avatar_url)}
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
      <img src="/icons/icon-leaf.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
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

/** ☰で開く、セカイムラ内のタブ一覧（下タブと同じ並び） */
const SEKAI_MENU = [
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ トップ" },
  { href: "/sekai/villages", icon: "/icons/icon-base.webp", label: "拠点" },
  { href: "/sekai/clubs", icon: "/icons/icon-broom.webp", label: "部活" },
  { href: "/sekai/kome", icon: "/icons/icon-rice.webp", label: "米部" },
  { href: "/sekai/meister", icon: "/icons/icon-course.webp", label: "講座" },
  { href: "/sekai/tasukete", icon: "/icons/icon-tasukete.webp", label: "助けて" },
  { href: "/sekai/map", icon: "/icons/icon-japanmap.webp", label: "地図" },
];

/** 左上の三本線メニュー。floating=ヘッダーが無いページ用(左上に浮かせる) */
export function SekaiMenuButton({ floating = false }: { floating?: boolean }) {
  const [open, setOpen] = useState(false);
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="セカイムラメニュー"
        className={
          floating
            ? "fixed left-3 z-[70] flex h-9 w-9 items-center justify-center rounded-full text-[19px] leading-none text-white shadow-md"
            : "absolute left-3 top-1/2 -translate-y-1/2 text-[22px] leading-none text-[#eaf2ff]"
        }
        style={floating ? { background: "rgba(42,78,150,.9)", top: "calc(env(safe-area-inset-top) + 10px)" } : undefined}
      >
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[85] bg-black/35" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 z-[86] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
            <div className="px-5 pb-2 pt-5">
              <div className="text-[10px] tracking-[2px] text-[#8fb8e8]">世界は一つの村になる。</div>
              <div className="text-[19px] font-extrabold" style={{ color: "#2a4e96" }}>セカイムラ</div>
            </div>
            {SEKAI_MENU.map((m) => {
              const here = path === m.href || (m.href !== "/sekai" && path.startsWith(m.href));
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 border-b border-[#f0f2f6] px-5 py-3 text-[14px] no-underline ${
                    here ? "bg-[#e8f0fc] font-bold text-[#2a4e96]" : "font-medium text-[#1c1e21]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  {m.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/** 各ページ共通の外枠（コンパクトなヒーロー + 右上アイコンはOneSeaと同じメニュー） */
export function SekaiShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="pb-[58px]" style={{ minHeight: "100dvh", background: "linear-gradient(180deg,#2a4e96 0%,#3560ac 100%)" }}>
      <TopTone color="#2a4e96" />
      <header className="relative z-[60] flex h-[52px] flex-col items-center justify-center border-b border-[#4a6ab0] px-6 text-center" style={{ background: "#2a4e96" }}>
        <div className="text-[10px] leading-tight tracking-[3px] text-[#8fb8e8]">世界は一つの村になる。</div>
        <div className="text-[17px] font-extrabold leading-snug tracking-[6px] text-[#eaf2ff]">セカイムラ</div>
        <SekaiMenuButton />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-left">
          <AvatarMenu />
        </span>
      </header>
      {/* PCは Cotozute と同じ3カラム（全幅・中央フィード・左右レール） */}
      <ThreeCol centerClassName="space-y-2.5 lg:rounded-xl">
        {children}
      </ThreeCol>
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
  const [moots] = useState<Moot[]>(() => upcomingMoots(11));
  const [futureOpen, setFutureOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [mineNo, setMineNo] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await fetchMootData(
      moots.map((m) => m.dateKey),
      me?.id ?? null
    );
    setCounts(r.counts);
    setMine(r.mine);
    setMineNo((r as { mineNo?: Set<string> }).mineNo ?? new Set());
  }, [me, moots]);

  useEffect(() => {
    load();
    fetchSettings().then(setSettings);
  }, [load]);

  const next = moots[0];
  const joined = next ? mine.has(next.dateKey) : false;
  const declined = next ? mineNo.has(next.dateKey) : false;
  const today = next?.dday === 0;

  /* 三択: 同じボタンをもう一度押すと未定に戻る。参加=手帳へ自動入力(アラーム無し)、外すと自動削除 */
  const rsvp = async (want: "yes" | "no") => {
    if (!me || !next) return;
    const cur = joined ? "yes" : declined ? "no" : null;
    const nextSt = cur === want ? null : want;
    await setRsvp(me.id, next.dateKey, next.kind, nextSt);
    if (nextSt === "yes") writeMootToTecho(next);
    else removeMootFromTecho(next);
    await load();
    onRsvped();
  };

  return (
    <section
      id="moots"
      className="card"
      style={{ background: "linear-gradient(150deg,#0f1a25,#1a2a38)", border: "none", padding: "10px 8px 12px", scrollMarginTop: 56 }}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/cel-moon.png" alt="" className="h-[18px] w-[18px] object-contain" style={{ transform: "scaleX(-1)" }} />
          <span className="text-[13px] font-extrabold tracking-[1px] text-[#f0e6c8]">セカイムラオンライン新月/満月会</span>
        </span>
        {me && <span className="text-[10px] text-[#5a7a68]">あなたの参加 {mootCount}回</span>}
      </div>

      {/* テレビ画面（当日はここにZoomの導線が出る） */}
      {next && (
        <div className="relative overflow-hidden rounded-xl border border-[#2a4a3a]">
          <img src="/sekai/zoom-tv.webp" alt="" className="w-full object-cover" />
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(8,16,24,.25) 0%, rgba(8,16,24,.02) 45%, rgba(8,16,24,.55) 100%)" }}
          />
          {/* 案内パネル（30%の半透明地に文字を重ねる） */}
          <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2.5 text-center" style={{ background: "rgba(8,16,24,.24)" }}>
            <div className="text-left text-[10px] font-bold tracking-[2px] text-[#a8d8b8]">Next</div>
            <div className="text-[27px] font-extrabold leading-snug text-[#ffd66a]" style={{ textShadow: "0 2px 14px rgba(0,0,0,.95)" }}>
              第{mootNoOf(next.dateKey) ?? "—"}回セカイムラ{next.kind === "new" ? "新月会" : "満月会"}
            </div>
            <div className="num mt-1 text-[16px] font-extrabold text-[#eef8f0]" style={{ textShadow: "0 1px 8px rgba(0,0,0,.9)" }}>
              {next.label}{next.hour}時〜（<img src="/icons/icon-hourglass.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2 }} />{today ? "今日" : next.dday === 1 ? "あと1日" : `あと${next.dday}日`}）
            </div>
            <div className="num mt-0.5 text-[10.5px] text-[#b8d8c8]" style={{ textShadow: "0 1px 6px rgba(0,0,0,.85)" }}>
              {counts.get(next.dateKey) ?? 0}人が参加予定
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
              <>
                <button
                  onClick={() => rsvp("yes")}
                  className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold"
                  style={
                    joined
                      ? { background: "rgba(42,90,58,.95)", color: "#a8d8b8", border: "1.5px solid #4a9a6a" }
                      : { background: "#d4b96a", color: "#1a2432" }
                  }
                >
                  {joined ? "✓ 参加する" : "参加する"}
                </button>
                <button
                  onClick={() => rsvp("no")}
                  className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold"
                  style={
                    declined
                      ? { background: "rgba(90,42,42,.9)", color: "#e8b8b8", border: "1.5px solid #9a4a4a" }
                      : { background: "rgba(20,28,38,.85)", color: "#d8e0e8", border: "1px solid #5a6a78" }
                  }
                >
                  {declined ? "✓ 参加しない" : "参加しない"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* 過去の一覧 ← 新月会・満月会 → 未来の予定（囲わず、文字だけ） */}
      <div className="mt-2.5 flex items-center justify-center gap-3 px-1">
        <button
          onClick={() => { setPastOpen((v) => !v); setFutureOpen(false); }}
          className="text-[11.5px] font-bold"
          style={{ color: pastOpen ? "#e8d5a0" : "#a8c8b0", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          過去動画一覧
        </button>
        <span className="text-[12px] font-extrabold tracking-[1px] text-[#7a9a88]">
          ← 第{mootNoOf(moots[0]?.dateKey) ?? "—"}回{moots[0]?.kind === "new" ? "新月会" : "満月会"} →
        </span>
        <button
          onClick={() => { setFutureOpen((v) => !v); setPastOpen(false); }}
          className="text-[11.5px] font-bold"
          style={{ color: futureOpen ? "#e8d5a0" : "#a8c8b0", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          未来の予定
        </button>
      </div>
      {futureOpen && (
        <div className="mt-1.5 rounded-xl bg-white/5 px-3 py-2">
          {moots.slice(1, 11).map((m) => (
            <div key={m.dateKey} className="flex items-baseline justify-between border-b border-white/5 py-1.5 last:border-0">
              <span className="text-[12px] font-bold text-[#a8c8b0]">
                第{mootNoOf(m.dateKey) ?? "—"}回セカイムラ{m.kind === "new" ? "新月会" : "満月会"}
              </span>
              <span className="num flex-shrink-0 text-[11.5px] text-[#7a9a88]">
                {m.label} {m.hour}時
              </span>
            </div>
          ))}
        </div>
      )}
      {pastOpen && (
        <div className="mt-1.5">
          {LATEST_MOOT_VIDEO && (
            <a
              href={LATEST_MOOT_VIDEO.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-2 block overflow-hidden rounded-xl border border-[#4a9a6a]/40 no-underline"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={srcCdn(LATEST_MOOT_VIDEO.thumb)} alt="" className="w-full object-cover" />
              <div className="bg-white/5 px-3 py-2 text-[12.5px] font-extrabold text-[#a8d8b8]">
                ▶ {LATEST_MOOT_VIDEO.title} — 今回の会の動画
              </div>
            </a>
          )}
          <MootArchive />
        </div>
      )}
    </section>
  );
}

/* ═══ 月例会の通し番号（2021年8月の満月会 = 第1回。開催日ベース） ═══ */
const MOOT_NO_YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027];
let MOOT_NO_LIST: Array<{ dateKey: string; kind: "new" | "full"; no: number }> | null = null;
function mootNoList() {
  if (MOOT_NO_LIST) return MOOT_NO_LIST;
  const raw: Array<{ time: number; kind: "new" | "full" }> = [];
  for (const y of MOOT_NO_YEARS) {
    for (const ev of moonsOfYear(y)) raw.push({ time: mootTimeOf(ev), kind: ev.type });
  }
  raw.sort((a, b) => a.time - b.time);
  const firstIdx = raw.findIndex((m) => m.kind === "full" && m.time >= Date.UTC(2021, 7, 1));
  MOOT_NO_LIST = raw.slice(firstIdx).map((m, i) => ({
    dateKey: new Date(m.time + 9 * 3600000).toISOString().slice(0, 10),
    kind: m.kind,
    no: i + 1,
  }));
  return MOOT_NO_LIST;
}
function mootNoOf(dateKey: string): number | null {
  return mootNoList().find((m) => m.dateKey === dateKey)?.no ?? null;
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
  const [seedOpen, setSeedOpen] = useState(false); // 「村を作る」カードで開く
  const [amOffice, setAmOffice] = useState(false); // 事務局は全報告を消せる
  useEffect(() => {
    if (!me) return;
    import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmOffice)).catch(() => {});
  }, [me]);
  const [stripSeeds, setStripSeeds] = useState<any[]>([]); // 村の予備軍（1人でも作ったら並ぶ）
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("village_seeds")
      .select("id, name, prefecture, cover_url, status")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .then(({ data }) => setStripSeeds(data ?? []));
  }, [seedOpen]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [myVills, setMyVills] = useState<Village[]>([]);
  const [writing, setWriting] = useState(false);
  const [evWriting, setEvWriting] = useState(false); // イベント作成モーダル
  const [wChoose, setWChoose] = useState(false); // 投稿の2択(①イベント作成 ②村の報告)
  const [evDetail, setEvDetail] = useState<any | null>(null); // イベントカードを開いた詳細
  const [evEditId, setEvEditId] = useState<string | null>(null); // 変更中のイベントid(nullなら新規作成)
  const evFromTecho = useRef(false); // 手帳の「詳細」から来た(閉じたら手帳へ戻す)
  const [evPeople, setEvPeople] = useState<{ list: any[]; total: number }>({ list: [], total: 0 }); // 詳細の参加者(先頭50人)
  useEffect(() => {
    if (!evDetail?.id) {
      setEvPeople({ list: [], total: 0 });
      return;
    }
    const supabase = createClient();
    Promise.all([
      supabase
        .from("event_rsvps")
        .select("user_id, profiles!event_rsvps_user_id_fkey(username, display_name, avatar_url)")
        .eq("post_id", evDetail.id)
        .limit(50),
      supabase.from("event_rsvps").select("post_id", { count: "exact", head: true }).eq("post_id", evDetail.id),
    ]).then(([{ data }, { count }]) => {
      setEvPeople({ list: (data ?? []).map((r: any) => r.profiles).filter(Boolean), total: count ?? (data ?? []).length });
    });
  }, [evDetail?.id]);
  const closeEvDetail = () => {
    setEvDetail(null);
    if (evFromTecho.current) {
      evFromTecho.current = false;
      // 手帳(元のページ)へ戻る。履歴が無ければURLのクエリだけ掃除
      if (window.history.length > 1) window.history.back();
      else window.history.replaceState(null, "", "/sekai");
    }
  };
  const [placeView, setPlaceView] = useState<PlaceInfo | null>(null); // 場所オーバーレイ
  const [wPlace, setWPlace] = useState<{ name: string | null; lat: number | null; lng: number | null; url: string; image: string | null } | null>(null);
  const [wPlacePaste, setWPlacePaste] = useState("");
  const [wPlaceMsg, setWPlaceMsg] = useState<string | null>(null);
  const [wPlaceBusy, setWPlaceBusy] = useState(false);

  /** Google共有リンク → 場所を自動取り込み(マイページのおススメ地図と同じ最新解決API) */
  const resolvePlace = async (raw: string): Promise<{ name: string | null; lat: number | null; lng: number | null; url: string; image: string | null } | null> => {
    const m = raw.match(/https?:\/\/[^\s]+/);
    if (!m || wPlaceBusy) return null;
    const url = m[0];
    const hint = raw.replace(url, "").replace(/[\n\r"']+/g, " ").trim().slice(0, 100);
    setWPlaceBusy(true);
    setWPlaceMsg(null);
    try {
      const r = await fetch("/api/reco/resolve?url=" + encodeURIComponent(url) + (hint ? "&hint=" + encodeURIComponent(hint) : ""));
      const d = await r.json();
      if (!r.ok || (!d.name && d.lat == null)) {
        setWPlaceMsg("リンクを読めませんでした。Googleマップ/Google検索の「共有」からコピーしたリンクを貼ってください");
      } else if (d.lat == null || d.lng == null) {
        setWPlaceMsg("場所（座標）が読めませんでした。Googleマップのアプリで場所を開いて「共有→リンクをコピー」だと確実です");
      } else {
        const got = { name: (d.name as string) ?? null, lat: d.lat as number, lng: d.lng as number, url, image: (d.image as string) ?? null };
        setWPlace(got);
        setWPlacePaste("");
        setWPlaceBusy(false);
        return got;
      }
    } catch {
      setWPlaceMsg("通信に失敗しました");
    }
    setWPlaceBusy(false);
    return null;
  };
  const [wKind, setWKind] = useState<"normal" | "event">("normal");
  const [wEventAt, setWEventAt] = useState("");
  const [wEventEnd, setWEventEnd] = useState(""); // 終了時刻(任意)
  const [joinedEv, setJoinedEv] = useState<Set<string>>(new Set());
  const [wVillage, setWVillage] = useState("");
  const [wBody, setWBody] = useState("");
  const [wPhoto, setWPhoto] = useState<string | null>(null);
  const [wUploading, setWUploading] = useState(false);
  const [wSaving, setWSaving] = useState(false);

  /* ── 下書き自動保存: アプリ切替・スリープ・強制終了でも入力が消えない ── */
  const VDRAFT_KEY = "onesea-vpost-draft";
  const clearVDraft = () => {
    try {
      localStorage.removeItem(VDRAFT_KEY);
    } catch {}
  };
  useEffect(() => {
    if (evEditId) return; // 既存イベントの編集は下書き対象外
    if (!evWriting && !writing) return;
    try {
      localStorage.setItem(
        VDRAFT_KEY,
        JSON.stringify({ ts: Date.now(), open: evWriting ? "event" : "report", kind: wKind, body: wBody, eventAt: wEventAt, eventEnd: wEventEnd, village: wVillage, photo: wPhoto, place: wPlace })
      );
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evWriting, writing, wKind, wBody, wEventAt, wEventEnd, wVillage, wPhoto, wPlace]);
  useEffect(() => {
    // 復元: 書きかけがあれば同じシートを開いて中身を戻す
    try {
      const raw = localStorage.getItem(VDRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d.ts || Date.now() - d.ts > 3 * 86400000 || !(d.body || d.eventAt)) {
        localStorage.removeItem(VDRAFT_KEY);
        return;
      }
      setWKind(d.kind ?? (d.open === "event" ? "event" : "normal"));
      setWBody(d.body ?? "");
      setWEventAt(d.eventAt ?? "");
      setWEventEnd(d.eventEnd ?? "");
      if (d.village) setWVillage(d.village);
      setWPhoto(d.photo ?? null);
      setWPlace(d.place ?? null);
      if (d.open === "event") setEvWriting(true);
      else if (d.open === "report") setWriting(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cmts, setCmts] = useState<Record<string, VillagePostComment[]>>({});
  const [cOpen, setCOpen] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [cSending, setCSending] = useState<string | null>(null);

  const FEED_PAGE = 5;
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
        "id, body, photo_url, kind, event_at, event_end, created_at, user_id, place_name, place_lat, place_lng, place_url, villages!village_posts_village_id_fkey(id, name, prefecture, cover_url, icon_url), profiles!village_posts_user_id_fkey(username, display_name, avatar_url)"
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

  // 手帳の「詳細」ボタンから /sekai?event=ID で来たら、そのイベントを開く
  useEffect(() => {
    try {
      const evId = new URLSearchParams(window.location.search).get("event");
      if (!evId) return;
      evFromTecho.current = true;
      const supabase = createClient();
      supabase
        .from("village_posts")
        .select(
          "id, body, photo_url, kind, event_at, event_end, created_at, user_id, place_name, place_lat, place_lng, place_url, villages!village_posts_village_id_fkey(id, name, prefecture, cover_url, icon_url), profiles!village_posts_user_id_fkey(username, display_name, avatar_url)"
        )
        .eq("id", evId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setEvDetail(data);
        });
    } catch {}
  }, []);

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
    `🏡${p.villages?.name ?? "セカイムラ全国"}: ${String(p.body ?? "").split("\n")[0].slice(0, 30)}`;

  /** 参加を取り消す → 手帳からその行を消す */
  const cancelEvent = (p: any) => {
    if (!p.event_at) return;
    const d = new Date(p.event_at);
    const key = keyOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const hour = String(d.getHours());
    const label = eventLabel(p);
    try {
      const memos = JSON.parse(readTecho());
      const day = memos[key];
      if (day?.ev?.length) {
        day.ev = day.ev.filter((x: any) => x.id !== `sekai-${p.id}`);
        if (!day.ev.length) delete day.ev;
        memos[key] = day;
        writeTecho(JSON.stringify(memos));
      }
      if (day?.h?.[hour]) {
        const lines = String(day.h[hour]).split("\n").filter((l: string) => l !== label);
        if (lines.length) day.h[hour] = lines.join("\n");
        else delete day.h[hour];
        if (!day.note && Object.keys(day.h ?? {}).length === 0) delete memos[key];
        else memos[key] = day;
        writeTecho(JSON.stringify(memos));
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
      const memos = JSON.parse(readTecho());
      const day = memos[key] ?? { note: "", h: {} };
      // 構造化された予定として登録: 手帳側でタップすると場所(Googleマップ)が開く
      day.ev = day.ev ?? [];
      const evId = `sekai-${p.id}`;
      if (!day.ev.some((x: any) => x.id === evId)) {
        // 終了時刻: 登録があればそれを、無ければ開始+2時間(同日内)
        const de = p.event_end ? new Date(p.event_end) : null;
        const sameDay = de && de.getFullYear() === d.getFullYear() && de.getMonth() === d.getMonth() && de.getDate() === d.getDate();
        day.ev.push({
          id: evId,
          sh: d.getHours(),
          sm: d.getMinutes(),
          eh: sameDay ? de!.getHours() : Math.min(23, d.getHours() + 2),
          em: sameDay ? de!.getMinutes() : d.getMinutes(),
          text: eventLabel(p),
          color: "green",
          place:
            p.place_lat != null || p.place_name
              ? { name: p.place_name ?? null, lat: p.place_lat ?? null, lng: p.place_lng ?? null, url: p.place_url ?? null }
              : undefined,
        });
        day.ev.sort((a: any, b: any) => a.sh * 60 + a.sm - (b.sh * 60 + b.sm));
      }
      memos[key] = day;
      writeTecho(JSON.stringify(memos));
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
    fetchVillages(null).then(async (list) => {
      // 現在地(onesea-pos)から近い順に並べる。座標は県の代表点(municipalities先頭)
      try {
        const pos = JSON.parse(localStorage.getItem("onesea-pos") ?? "null");
        if (pos && typeof pos.lat === "number") {
          const muni = await fetch("/data-municipalities.json").then((r) => r.json());
          const center = (pref: string | null) => {
            const arr = pref ? muni[pref] : null;
            return arr && arr[0] ? { lat: arr[0][1], lng: arr[0][2] } : null;
          };
          const dist = (v: Village) => {
            const c = center(v.prefecture);
            if (!c) return 9e9;
            const dx = (c.lng - pos.lon) * Math.cos((pos.lat * Math.PI) / 180);
            const dy = c.lat - pos.lat;
            return dx * dx + dy * dy;
          };
          list = [...list].sort((a, b) => dist(a) - dist(b));
        }
      } catch {}
      setVillages(list);
    });
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
    const nationwide = wVillage === "__all__" && amOffice; // 事務局の全国イベント
    if (!me || (!wVillage && !nationwide) || !wBody.trim() || wSaving) return;
    // 場所リンクが貼られたのに未取り込みなら、保存前にここで取り込む(押すのが早くても場所が落ちない)
    let placeNow = wPlace;
    if (wKind === "event" && !placeNow && /https?:\/\//.test(wPlacePaste)) {
      placeNow = await resolvePlace(wPlacePaste);
    }
    setWSaving(true);
    const supabase = createClient();
    const eventAt = wKind === "event" && wEventAt ? new Date(wEventAt).toISOString() : null;
    let eventEnd = wKind === "event" && wEventEnd ? new Date(wEventEnd).toISOString() : null;
    if (eventAt && eventEnd && eventEnd <= eventAt) eventEnd = null; // 開始より前の終了は無効
    if (evEditId) {
      // 既存イベントの変更(日時・内容・写真・場所)
      await supabase
        .from("village_posts")
        .update({
          body: wBody.trim(),
          photo_url: wPhoto,
          event_at: eventAt,
          event_end: eventEnd,
          place_name: wPlace?.name ?? null,
          place_lat: wPlace?.lat ?? null,
          place_lng: wPlace?.lng ?? null,
          place_url: wPlace?.url ?? null,
        })
        .eq("id", evEditId);
      setWSaving(false);
      setEvWriting(false);
      setEvEditId(null);
      setWKind("normal");
      setWBody("");
      setWPhoto(null);
      setWEventAt("");
      setWEventEnd("");
      setWPlace(null);
      setWPlacePaste("");
      setWPlaceMsg(null);
      clearVDraft();
      loadEvents();
      loadFeed();
      return;
    }
    // 本文にSNS等のリンクがあれば、コトヅテと同じ自動切り抜き埋め込みを作る(入力欄は1つのまま)
    let embed: { url: string; title?: string; description?: string; image?: string; platform?: string } | null = null;
    if (wKind === "normal") {
      const um = wBody.match(/https?:\/\/[^\s]+/);
      if (um) {
        try {
          const r = await fetch(`/api/ogp?url=${encodeURIComponent(um[0])}`);
          if (r.ok) {
            const d = await r.json();
            embed = { url: um[0], title: d.title, description: d.description, image: d.image, platform: d.platform };
          } else {
            embed = { url: um[0] };
          }
        } catch {
          embed = { url: um[0] };
        }
      }
    }
    const { data: inserted } = await supabase
      .from("village_posts")
      .insert({
        village_id: nationwide ? null : wVillage,
        user_id: me.id,
        body: wBody.trim(),
        embed,
        photo_url: wPhoto, // 写真なしなら無し(場所画像は地図サムネ事故があるので使わない)
        kind: wKind,
        event_at: eventAt,
        event_end: eventEnd,
        place_name: wKind === "event" ? placeNow?.name ?? null : null,
        place_lat: wKind === "event" ? placeNow?.lat ?? null : null,
        place_lng: wKind === "event" ? placeNow?.lng ?? null : null,
        place_url: wKind === "event" ? placeNow?.url ?? null : null,
      })
      .select("id")
      .single();
    // 自分で立ち上げたイベントは、参加ボタンなしで自分の手帳に自動登録
    if (eventAt && inserted) {
      joinEvent({
        id: inserted.id,
        event_at: eventAt,
        event_end: eventEnd,
        body: wBody.trim(),
        place_name: placeNow?.name ?? null,
        place_lat: placeNow?.lat ?? null,
        place_lng: placeNow?.lng ?? null,
        place_url: placeNow?.url ?? null,
        villages: nationwide ? null : { name: myVills.find((v) => v.id === wVillage)?.name },
      });
    }
    setWSaving(false);
    setWriting(false);
    setEvWriting(false);
    setWKind("normal");
    setWBody("");
    setWPhoto(null);
    setWEventAt("");
    setWEventEnd("");
    setWPlace(null);
    setWPlacePaste("");
    setWPlaceMsg(null);
    clearVDraft();
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
        style={{ background: "linear-gradient(150deg,#0e2a4e,#1a4a7a)" }}
      >
        <div className="text-center text-[15px] font-extrabold tracking-[3px] text-[#cfe4f8]">村人便り</div>
      </div>

      {/* 📅 これからのイベント（横スクロール・旧セカイムラ式） */}
      {(events.length > 0 || (me && myVills.length > 0)) && (
        <div className="mb-2">
          <div className="px-3 pb-1 text-[12px] font-extrabold" style={{ color: GREEN }}>
            📅 イベント
          </div>
          <div className="hide-scrollbar flex gap-2.5 overflow-x-auto px-3 pb-1.5">
            {/* 一番左: イベントを投稿するカード */}
            {me && (myVills.length > 0 || amOffice) && (
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
                  onClick={() => setEvDetail(p)}
                  className="w-[230px] flex-shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-[#e2eae0] bg-white shadow-sm"
                >
                  <div className="relative h-[110px] bg-[#eaf2ea]">
                    {p.photo_url ? (
                      <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-[13px] font-extrabold text-white"
                        style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}
                      >
                        <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> {p.villages?.name ?? "🌏 セカイムラ全国"}
                      </div>
                    )}
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-[9px] font-extrabold text-white"
                      style={{ background: "#4a9a5a" }}
                    >
                      {p.villages?.name ?? "🌏 全国"}
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
                        {p.event_end && new Date(p.event_end).toDateString() === d.toDateString()
                          ? `${new Date(p.event_end).getHours()}:${String(new Date(p.event_end).getMinutes()).padStart(2, "0")}`
                          : ""}
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
                          onClick={(e) => { e.stopPropagation(); cancelEvent(p); }}
                          className="rounded-full border px-2.5 py-1 text-[10.5px] font-bold"
                          style={{ borderColor: "#4a9a5a", color: GREEN, background: "#fff" }}
                        >
                          ✓ 参加予定
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); joinEvent(p); }}
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
          <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> 拠点に入ると、ここから「村人日記」を書けます →
        </a>
      )}

      {/* 活動を報告する（自分の村がある人だけ） */}
      {me && (myVills.length > 0 || amOffice) && (
          <button
          onClick={() => setWChoose(true)}
          className="mx-2 mb-2 block w-[calc(100%-16px)] rounded-2xl border bg-white px-3.5 py-3 text-left shadow-sm"
          style={{ borderColor: "#c8dccb" }}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#eaf4ec]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/icon-pen.webp" alt="" style={{ width: 18, height: 18 }} />
            </span>
            <span className="flex-1 text-[13.5px] text-[#9ab3a0]">村からの投稿 <img src="/icons/icon-pen.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /></span>
            <span
              className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold text-white"
              style={{ background: GREEN }}
            >
              投稿
            </span>
          </div>
        </button>
      )}


      {/* 活動報告フィード */}
      {feed === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : feed.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#4a8a5c44] px-4 py-5 text-center">
          <div className="flex justify-center"><img src="/icons/icon-megaphone.webp" alt="" style={{ width: 30, height: 30 }} /></div>
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
            <div key={p.id} className="relative overflow-hidden rounded-xl border border-[#e2eae0] bg-white">
              {me && (me.id === p.user_id || amOffice) && (
                <button
                  onClick={async () => {
                    if (!confirm("本当に削除していいですか？")) return;
                    const supabase = createClient();
                    await supabase.from("village_posts").delete().eq("id", p.id);
                    loadFeed();
                  }}
                  aria-label="削除"
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f2f5] text-[13px] font-bold text-[#65676b]"
                >
                  ×
                </button>
              )}
              <div className="p-3">
                {/* ヘッダー: 誰（どの拠点）が投稿したか → 本文 → 写真 の順 */}
                <Link
                  href={`/sekai/village/${p.villages?.id}`}
                  className="flex items-center gap-2.5 no-underline"
                >
                  {/* 拠点(=ページ)のアイコン。個人ではなく村の顔で発信する */}
                  {p.villages?.icon_url ? (
                    <img
                      src={srcCdn(p.villages.icon_url)}
                      alt=""
                      className="h-11 w-11 flex-shrink-0 rounded-full border border-[#dce8dc] object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[20px]"
                      style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}
                    >
                      🏡
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0 truncate text-[14.5px] font-extrabold" style={{ color: GREEN }}>
                      {p.villages?.name ?? "セカイムラ"}
                      <span className="text-[12px] font-bold text-[#7a9a80]">からの投稿</span>
                      <span className="ml-1"><SekaiBadge size={14} /></span>
                    </div>
                    <div className="num text-[10.5px] text-[#b0bcb0]">
                      {p.villages?.prefecture ? `@${p.villages.prefecture} ・ ` : ""}
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
                          ✓ 参加予定（タップで取消）
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
                  <img src={srcCdn(p.photo_url)} alt="" loading="lazy" className="mt-2 max-h-96 w-full rounded-xl object-cover" />
                )}
                {p.embed && (
                  <div className="mt-2">
                    <EmbedCard embed={p.embed} />
                  </div>
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

      {/* 見出し: 全国のセカイムラ一覧（拠点ストリップはこの下へ移動） */}
      <div className="mb-2 mt-3 px-4 pb-2.5 pt-3.5" style={{ background: "linear-gradient(150deg,#0e2a4e,#1a4a7a)" }}>
        <div className="text-center text-[15px] font-extrabold tracking-[3px] text-[#cfe4f8]">全国のセカイムラ一覧</div>
      </div>

      {/* <img src="/icons/icon-base.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> 各地のセカイムラ拠点 — レジェンドが近い順にズラリ（横スワイプ） */}
      <div className="hide-scrollbar mb-2 flex gap-2.5 overflow-x-auto px-3 pb-1.5 pt-1">
        {villages.map((v) => (
          <Link
            key={v.id}
            href={`/sekai/village/${v.id}`}
            className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#e2eae0] bg-white no-underline shadow-sm"
          >
            <div className="relative h-[86px] bg-[#eaf2ea]">
              {v.cover_url ? (
                <img src={srcCdn(v.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-[22px]"
                  style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}
                >
                  🏡
                </div>
              )}
              {v.is_official && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d4b96a] px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#1a2432]">
                  公式
                </span>
              )}
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[12px] font-extrabold" style={{ color: GREEN }}>
                {v.name}
              </div>
              <div className="truncate text-[10px] text-[#a0aca0]">
                {v.prefecture ?? ""}
                {v.village_members?.[0]?.count ? ` ・ ${v.village_members[0].count}人` : ""}
              </div>
            </div>
          </Link>
        ))}
        {/* 村の予備軍 — 1人でも立ち上げたらここに並ぶ */}
        {stripSeeds.map((sd) => (
          <button
            key={sd.id}
            onClick={() => setSeedOpen(true)}
            className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#c8dcc0] bg-white text-left shadow-sm"
          >
            <div className="relative h-[86px] bg-[#eef6ea]">
              {sd.cover_url ? (
                <img src={srcCdn(sd.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center" style={{ background: "linear-gradient(150deg,#d8ecd0,#a8cca0)" }}>
                  <img src="/icons/icon-sprout.webp" alt="" style={{ width: 30, height: 30 }} />
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-[#4a8a5c] px-1.5 py-0.5 text-[8.5px] font-extrabold text-white">
                募集中
              </span>
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[11.5px] font-extrabold" style={{ color: GREEN }}>
                村を作る人募集{sd.prefecture ? `（${sd.prefecture}）` : ""}
              </div>
              <div className="truncate text-[10px] text-[#a0aca0]">{sd.name} ▼</div>
            </div>
          </button>
        ))}
        {/* 一番右: 村を作るカード（押すと下に村の種セクションが開く） */}
        <button
          onClick={() => setSeedOpen((o) => !o)}
          className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border-2 border-dashed bg-white text-left shadow-sm"
          style={{ borderColor: seedOpen ? "#4a8a5c" : "#c8dccb" }}
        >
          <div className="flex h-[86px] w-full items-center justify-center" style={{ background: "linear-gradient(150deg,#eaf6ec,#d8ecdc)" }}>
            <img src="/icons/icon-sprout.webp" alt="" style={{ width: 34, height: 34 }} />
          </div>
          <div className="px-2 py-1.5">
            <div className="text-[12px] font-extrabold" style={{ color: GREEN }}>＋ 村を作りたい</div>
            <div className="truncate text-[10px] text-[#a0aca0]">{seedOpen ? "閉じる ▲" : "3人集めて申請 ▼"}</div>
          </div>
        </button>
      </div>

      {/* 🌱 一緒に村を作りたい人へ（村の種）— 「村を作る」カードで開閉 */}
      {seedOpen && <SeedSection me={me} />}


      {/* ✏️ 村の報告シート(下から出てくる — イベント作成と同じ挙動) */}
      {writing && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45" onClick={() => { setWriting(false); clearVDraft(); }}>
          <div
            className="w-full max-w-[480px] md:max-w-[820px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#ddd]" />
            <div className="mb-2 text-[13.5px] font-extrabold" style={{ color: GREEN }}>
              ✏️ 村の報告
            </div>
            {myVills.length > 1 && (
              <select
                value={wVillage}
                onChange={(e) => setWVillage(e.target.value)}
                className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {myVills.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}（{v.prefecture}）
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={wBody}
              onChange={(e) => setWBody(e.target.value)}
              rows={3}
              autoFocus
              placeholder="例: 今日は田植えをした / 古民家の床を張り替えました / ここに他社SNSのリンクを貼る事も出来ます"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 flex items-center gap-2">
              {wPhoto && <img src={srcCdn(wPhoto)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
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
              <button onClick={() => { setWriting(false); clearVDraft(); }} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                キャンセル
              </button>
              <button
                onClick={publish}
                disabled={!wBody.trim() || wSaving || wUploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {wSaving ? "投稿中..." : "全国に報告する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 投稿の2択: ①イベントを作成 ②村の報告 */}
      {wChoose && me && (
        <div className="fixed inset-0 z-[89] flex items-end justify-center bg-black/45" onClick={() => setWChoose(false)}>
          <div
            className="w-full max-w-[480px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#ddd]" />
            <div className="mb-2.5 text-center text-[13px] font-extrabold" style={{ color: GREEN }}>
              村からの投稿
            </div>
            <button
              onClick={() => {
                setWChoose(false);
                setWKind("event");
                if (amOffice && myVills.length === 0) setWVillage("__all__");
                setEvWriting(true);
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left"
              style={{ borderColor: "#c8a030", background: "#fdf9ec" }}
            >
              <span className="text-[22px]">📅</span>
              <span>
                <span className="block text-[14px] font-extrabold text-[#a07820]">① イベントを作成</span>
                <span className="block text-[11px] text-[#b09a60]">日時・場所つき。下のイベント欄に並びます</span>
              </span>
            </button>
            <button
              onClick={() => {
                setWChoose(false);
                setWKind("normal");
                setWriting(true);
              }}
              className="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left"
              style={{ borderColor: "#4a8a5c", background: "#f4faf5" }}
            >
              <span className="text-[22px]">✏️</span>
              <span>
                <span className="block text-[14px] font-extrabold" style={{ color: GREEN }}>② 村の報告</span>
                <span className="block text-[11px] text-[#8aa890]">写真つきの活動報告。フィードに流れます</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 📅 イベント作成モーダル */}
      {evWriting && me && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/45" onClick={() => { setEvWriting(false); setEvEditId(null); clearVDraft(); }}>
          <div
            className="w-full max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] rounded-t-2xl bg-white px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-[#ddd]" />
            <div className="mb-2 text-[13.5px] font-extrabold" style={{ color: GREEN }}>
              📅 {evEditId ? "イベントを変更" : "イベントを作成"}
            </div>
            {(myVills.length > 1 || amOffice) && (
              <select
                value={wVillage}
                onChange={(e) => setWVillage(e.target.value)}
                className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {amOffice && <option value="__all__">🌏 全国のみんなへ（事務局イベント）</option>}
                {myVills.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}（{v.prefecture}）
                  </option>
                ))}
              </select>
            )}
            <div className="mb-2 flex items-center gap-2">
              <span className="w-9 flex-shrink-0 text-[11px] font-extrabold text-[#8a9a8a]">開始</span>
              <input
                type="datetime-local"
                value={wEventAt}
                onChange={(e) => setWEventAt(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
              />
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="w-9 flex-shrink-0 text-[11px] font-extrabold text-[#8a9a8a]">終了</span>
              <input
                type="datetime-local"
                value={wEventEnd}
                onChange={(e) => setWEventEnd(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[13px] outline-none"
              />
              <span className="flex-shrink-0 text-[10px] text-[#a0aca0]">任意</span>
            </div>
            <textarea
              value={wBody}
              onChange={(e) => setWBody(e.target.value)}
              rows={3}
              autoFocus
              placeholder="例: 田植えイベントやります！持ち物は長靴と着替え"
              className="mb-2 w-full resize-y rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 flex items-center gap-2">
              {wPhoto && <img src={srcCdn(wPhoto)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
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
            {/* 場所: Googleの共有リンクを貼るだけで自動取り込み(おススメ地図と同じ仕組み) */}
            <div className="mb-2">
              <div className="mb-1 text-[11px] font-extrabold text-[#8a9a8a]">
                📍 場所 — Googleマップ/Google検索で場所を調べて「共有」→リンクをコピーして貼るだけ
              </div>
              {wPlace ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#c8dccb] bg-[#f4faf5] px-3 py-2">
                  {wPlace.image && <img src={wPlace.image} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-cover" />}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold" style={{ color: GREEN }}>
                    ✓ {wPlace.name ?? "場所を取り込みました"}
                  </span>
                  <button
                    onClick={() => setWPlace(null)}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-bold text-[#a0aca0]"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-1.5">
                    <input
                      value={wPlacePaste}
                      onChange={(e) => {
                        setWPlacePaste(e.target.value);
                        if (/https?:\/\//.test(e.target.value)) resolvePlace(e.target.value);
                      }}
                      onPaste={(e) => {
                        const t = e.clipboardData.getData("text");
                        if (/https?:\/\//.test(t)) setTimeout(() => resolvePlace(t), 50);
                      }}
                      placeholder="https://maps.app.goo.gl/… または https://share.google/…"
                      className="min-w-0 flex-1 rounded-xl border border-[#e2eae0] bg-white px-3 py-2 text-[12.5px] outline-none focus:border-[#4a8a5c]"
                    />
                    <button
                      onClick={() => resolvePlace(wPlacePaste)}
                      disabled={!/https?:\/\//.test(wPlacePaste) || wPlaceBusy}
                      className="flex-shrink-0 rounded-xl px-3 py-2 text-[12px] font-extrabold text-white disabled:opacity-40"
                      style={{ background: "#4a8a5c" }}
                    >
                      {wPlaceBusy ? "…" : "読み取る"}
                    </button>
                  </div>
                  {wPlaceBusy && <p className="mt-1 text-[11px] text-[#8a9a8a]">場所を読み取り中…</p>}
                  {wPlaceMsg && <p className="mt-1 text-[11px] font-bold text-[#c05030]">{wPlaceMsg}</p>}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEvWriting(false); setEvEditId(null); clearVDraft(); }} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a0aca0]">
                キャンセル
              </button>
              <button
                onClick={publish}
                disabled={!wBody.trim() || !wEventAt || wSaving || wUploading || wPlaceBusy}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {wSaving ? "保存中..." : evEditId ? "✏️ 変更を保存する" : "📅 イベントを作成する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📅 イベント詳細（カードをタップで立ち上がる） */}
      {evDetail && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/55 px-4" onClick={closeEvDetail}>
          <div
            className="max-h-[86vh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 拠点ページのサムネ */}
            <div className="relative h-[120px] bg-[#eaf2ea]">
              {evDetail.villages?.cover_url ? (
                <img src={srcCdn(evDetail.villages.cover_url)} alt="" className="h-full w-full object-cover" />
              ) : evDetail.photo_url ? (
                <img src={srcCdn(evDetail.photo_url)} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[26px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>🏡</div>
              )}
              <button
                onClick={closeEvDetail}
                aria-label="とじる"
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-[15px] font-bold text-white"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <Link href={`/sekai/village/${evDetail.villages?.id}`} className="no-underline" onClick={() => setEvDetail(null)}>
                <span className="text-[16px] font-extrabold" style={{ color: GREEN }}>
                  {evDetail.villages?.name ?? "🌏 セカイムラ事務局（全国のみんなへ）"}
                </span>
                <span className="ml-1 text-[12px] font-bold text-[#9ab3a0]">
                  {evDetail.villages?.prefecture ? `@${evDetail.villages.prefecture}` : ""}
                </span>
                <span className="ml-1"><SekaiBadge size={14} /></span>
              </Link>
              {/* 日時 + 参加する */}
              {evDetail.event_at && (
                <div className="mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2.5" style={{ background: "#fdf6e4", border: "1px solid #e8d8a8" }}>
                  <span className="num min-w-0 text-[13.5px] font-extrabold text-[#a07820]">
                    📅 {(() => {
                      const d = new Date(evDetail.event_at);
                      const de = evDetail.event_end ? new Date(evDetail.event_end) : null;
                      const sameDay = de && de.toDateString() === d.toDateString();
                      const t = (x: Date) => `${x.getHours()}:${String(x.getMinutes()).padStart(2, "0")}`;
                      return `${d.getMonth() + 1}月${d.getDate()}日（${YOBI[d.getDay()]}）${t(d)}〜${de ? (sameDay ? t(de) : `${de.getMonth() + 1}/${de.getDate()} ${t(de)}`) : ""}`;
                    })()}
                  </span>
                  {me &&
                    (joinedEv.has(evDetail.id) ? (
                      <button
                        onClick={() => cancelEvent(evDetail)}
                        className="flex-shrink-0 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold"
                        style={{ borderColor: "#c8a030", color: "#a07820", background: "#fff" }}
                      >
                        ✓ 参加予定
                      </button>
                    ) : (
                      <button
                        onClick={() => joinEvent(evDetail)}
                        className="flex-shrink-0 rounded-lg px-3.5 py-2 text-[12px] font-extrabold text-white"
                        style={{ background: "#c8a030" }}
                      >
                        参加する
                      </button>
                    ))}
                </div>
              )}
              <p className="mt-2.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-[#3a4438]">
                {String(evDetail.body ?? "")}
              </p>
              {evDetail.photo_url && evDetail.villages?.cover_url && (
                <img src={srcCdn(evDetail.photo_url)} alt="" className="mt-2 max-h-72 w-full rounded-xl object-cover" />
              )}
              {(evDetail.place_name || evDetail.place_lat != null) && (
                <button
                  onClick={() =>
                    setPlaceView({ name: evDetail.place_name, lat: evDetail.place_lat, lng: evDetail.place_lng, url: evDetail.place_url })
                  }
                  className="mt-2.5 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-extrabold"
                  style={{ borderColor: "#c8dccb", color: "#3070b0", background: "#f6faff" }}
                >
                  📍 <span className="min-w-0 flex-1 truncate">{evDetail.place_name ?? "場所の詳細"}</span>
                  <span className="flex-shrink-0 text-[11px]">地図を見る →</span>
                </button>
              )}
              {/* 参加者: 先頭50人をスワイプでズラーッと */}
              {evPeople.total > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-[11.5px] font-extrabold" style={{ color: GREEN }}>
                    参加者 {evPeople.total}人
                    {evPeople.total > 5 && <span className="ml-1 font-normal text-[#a0aca0]">（スワイプで{Math.min(50, evPeople.total)}人まで見られます）</span>}
                  </div>
                  <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
                    {evPeople.list.map((pr: any, i: number) => (
                      <span key={i} className="flex w-[44px] flex-shrink-0 flex-col items-center">
                        <AvatarSm p={pr} size={38} />
                        <span className="mt-0.5 w-full truncate text-center text-[8.5px] text-[#8a9a8a]">{pr?.display_name ?? ""}</span>
                      </span>
                    ))}
                    {evPeople.total > evPeople.list.length && (
                      <span className="flex h-[38px] flex-shrink-0 items-center rounded-full bg-[#eef4ee] px-3 text-[11px] font-extrabold" style={{ color: GREEN }}>
                        ほか{evPeople.total - evPeople.list.length}人
                      </span>
                    )}
                  </div>
                </div>
              )}
              <p className="mt-2 text-[10.5px] text-[#a0aca0]">
                「参加する」を押すと、あなたの手帳のこの日にイベントが入ります。手帳側でタップすると場所の地図が開きます。
              </p>
              {/* 作成者は変更・削除、事務局は削除ができる */}
              {me && (me.id === evDetail.user_id || amOffice) && (
                <div className="mt-2.5 flex gap-2 border-t border-[#eef2ec] pt-2.5">
                  {(me.id === evDetail.user_id || amOffice) && (
                    <button
                      onClick={() => {
                        const d = evDetail.event_at ? new Date(evDetail.event_at) : null;
                        const pad2 = (n: number) => String(n).padStart(2, "0");
                        setWKind("event");
                        setWVillage(evDetail.villages?.id ?? "__all__");
                        setWEventAt(d ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : "");
                        const de = evDetail.event_end ? new Date(evDetail.event_end) : null;
                        setWEventEnd(de ? `${de.getFullYear()}-${pad2(de.getMonth() + 1)}-${pad2(de.getDate())}T${pad2(de.getHours())}:${pad2(de.getMinutes())}` : "");
                        setWBody(String(evDetail.body ?? ""));
                        setWPhoto(evDetail.photo_url ?? null);
                        setWPlace(
                          evDetail.place_name || evDetail.place_lat != null
                            ? { name: evDetail.place_name ?? null, lat: evDetail.place_lat ?? null, lng: evDetail.place_lng ?? null, url: evDetail.place_url ?? "", image: null }
                            : null
                        );
                        setEvEditId(evDetail.id);
                        setEvDetail(null);
                        setEvWriting(true);
                      }}
                      className="flex-1 rounded-xl border py-2.5 text-[12.5px] font-extrabold"
                      style={{ borderColor: "#4a8a5c", color: GREEN, background: "#f4faf5" }}
                    >
                      ✏️ 変更する
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (!confirm("本当にイベントを削除しますか？")) return;
                      const supabase = createClient();
                      await supabase.from("village_posts").delete().eq("id", evDetail.id);
                      cancelEvent(evDetail); // 自分の手帳からも消す
                      setEvDetail(null);
                      loadEvents();
                      loadFeed();
                    }}
                    className="flex-1 rounded-xl border py-2.5 text-[12.5px] font-extrabold"
                    style={{ borderColor: "#e0b0a8", color: "#c05030", background: "#fdf6f4" }}
                  >
                    🗑 イベントを削除
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {placeView && <PlaceOverlay place={placeView} onClose={() => setPlaceView(null)} />}

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
      router.push(`/talk/${chatId}`);
    }
  };

  // 自分と同じ県の新入り村人だけ
  const samePref = recent.filter((p) => p.prefecture === myPref);
  if (samePref.length === 0) return null;

  return (
    <section className="card">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          <img src="/icons/icon-wakaba.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> 私の県の新しい村人
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
                {sent.has(p.id) ? "送りました " : "ようこそを送る"}
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
        <img src="/icons/icon-tea.webp" alt="" style={{ width: 32, height: 32 }} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-extrabold text-[#f0e2c8]">村人ラウンジ喫茶 〜いつでもオープン〜</div>
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
          ラウンジに入る
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
          <img src="/icons/icon-tea.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> {pref}ラウンジ
        </span>
        {travelMode && (
          <span className="rounded-full bg-[#fdf0e0] px-2 py-0.5 text-[10px] font-bold text-[#c08030]">
            <img src="/icons/icon-trunk.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 旅先モード
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
          まだ誰も書いていません。最初のひとことが、この地域の火種になります <img src="/icons/icon-torch.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} />
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
                    if (chatId) router.push(`/talk/${chatId}`);
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

/* ═══ 拠点（村）— 上: 写真ストリップ(会員数順) / 県セレクト / 写真つき一覧 / ＋村を作りたい ═══ */
export function VillagesSection({
  me,
  myPref,
  router,
}: {
  me: User | null;
  myPref: string;
  router: ReturnType<typeof useRouter>;
}) {
  void myPref;
  void router;
  const [villages, setVillages] = useState<Village[] | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const [pref, setPref] = useState(""); // "" = 全世界の拠点

  const load = useCallback(async () => {
    const list = await fetchVillages(null);
    setVillages(list);
    if (me) setMineIds(await myVillageIds(me.id));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  const memberN = (v: Village) => v.village_members?.[0]?.count ?? 0;
  const shown = (villages ?? [])
    .filter((v) => !pref || v.prefecture === pref)
    .sort((a, b) => memberN(b) - memberN(a)); // 会員数が多い順

  const goSeed = () => {
    document.getElementById("seed-sec")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="card">
      <SectionTitle>
        <img src="/icons/icon-base.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3 }} />{" "}
        {pref || "全世界"}の拠点{villages ? `（${shown.length}）` : ""}
      </SectionTitle>

      {/* ① 写真ストリップ — トップページと同じ。会員数が多い順 */}
      <div className="hide-scrollbar -mx-3 mb-2.5 flex gap-2.5 overflow-x-auto px-3 pb-1.5 pt-1" data-noswipe>
        {shown.map((v) => (
          <Link
            key={v.id}
            href={`/sekai/village/${v.id}`}
            className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#e2eae0] bg-white no-underline shadow-sm"
          >
            <div className="relative h-[86px] bg-[#eaf2ea]">
              {v.cover_url ? (
                <img src={srcCdn(v.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[22px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>
                  🏡
                </div>
              )}
              {v.is_official && (
                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#d4b96a] px-1.5 py-0.5 text-[8.5px] font-extrabold text-[#1a2432]">公式</span>
              )}
            </div>
            <div className="px-2 py-1.5">
              <div className="truncate text-[12px] font-extrabold" style={{ color: GREEN }}>{v.name}</div>
              <div className="truncate text-[10px] text-[#a0aca0]">
                {v.prefecture ?? ""} ・ {memberN(v)}人
              </div>
            </div>
          </Link>
        ))}
        {/* 一番右: ＋村を作りたい（トップページと同じカード） */}
        <button
          onClick={goSeed}
          className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-[#c8dccb] bg-white text-left shadow-sm"
        >
          <div className="flex h-[86px] w-full items-center justify-center" style={{ background: "linear-gradient(150deg,#eaf6ec,#d8ecdc)" }}>
            <img src="/icons/icon-sprout.webp" alt="" style={{ width: 34, height: 34 }} />
          </div>
          <div className="px-2 py-1.5">
            <div className="text-[12px] font-extrabold" style={{ color: GREEN }}>＋ 村を作りたい</div>
            <div className="truncate text-[10px] text-[#a0aca0]">3人集めて申請 ▼</div>
          </div>
        </button>
      </div>

      {/* ② 県セレクト */}
      <select
        value={pref}
        onChange={(e) => setPref(e.target.value)}
        className="mb-2.5 w-full rounded-xl border-2 border-[#c8dccb] bg-white px-3 py-2.5 text-[13.5px] font-bold outline-none"
        style={{ color: GREEN }}
      >
        <option value="">🌏 全世界の拠点（会員数が多い順）</option>
        {[...new Set((villages ?? []).map((v) => v.prefecture).filter(Boolean))].sort().map((pf) => (
          <option key={pf as string} value={pf as string}>
            {pf}（{(villages ?? []).filter((v) => v.prefecture === pf).length}）
          </option>
        ))}
      </select>

      {/* ③ 写真つき一覧（縦） */}
      {villages === null ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
      ) : shown.length === 0 ? (
        <p className="py-2 text-[12px] text-[#a0aca0]">この地域にはまだ拠点がありません。あなたが最初の村長に</p>
      ) : (
        <div className="space-y-2">
          {shown.map((v) => {
            const joined = mineIds.has(v.id);
            return (
              <Link
                key={v.id}
                href={`/sekai/village/${v.id}`}
                className="flex items-center gap-2.5 overflow-hidden rounded-xl border bg-white p-2 no-underline"
                style={{ borderColor: v.is_official ? "#d4b96a88" : "#e2eae0" }}
              >
                <div className="relative h-[64px] w-[92px] flex-shrink-0 overflow-hidden rounded-lg bg-[#eaf2ea]">
                  {v.cover_url ? (
                    <img src={srcCdn(v.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[20px]" style={{ background: "linear-gradient(150deg,#4a9a5a,#1e4530)" }}>
                      🏡
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-extrabold text-[#2a4a34]">{v.name}</span>
                    {v.is_official && (
                      <span className="flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold" style={{ background: "#f8f0d8", color: "#a08030", border: "1px solid #d4b96a" }}>公式</span>
                    )}
                    {joined && <span className="flex-shrink-0 text-[9px] font-bold text-[#4a9a6a]">✓ 参加中</span>}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-[#a0aca0]">
                    {v.prefecture ?? ""}
                    {v.city ? ` ${v.city}` : ""} ・ {memberN(v)}人 ・ 村長 {v.profiles?.display_name ?? "—"}
                  </div>
                  {v.description && <div className="mt-0.5 truncate text-[11px] text-[#8a968a]">{v.description}</div>}
                </div>
                <span className="flex-shrink-0 pr-1 text-[12px] text-[#c0ccc0]">›</span>
              </Link>
            );
          })}
        </div>
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
                className="overflow-hidden rounded-xl border p-3 no-underline"
                style={{
                  borderColor: c.is_official ? "#d4b96a88" : "#e2eae0",
                  ...((c as { cover_url?: string | null }).cover_url
                    ? { backgroundImage: `linear-gradient(rgba(255,255,255,.82), rgba(255,255,255,.9)), url(${(c as { cover_url?: string | null }).cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: "#fff" }),
                }}
              >
                <div className="flex items-center gap-1.5">
                  {(c as { icon_url?: string | null }).icon_url ? (
                    <img src={(c as { icon_url?: string | null }).icon_url!} alt="" className="h-[26px] w-[26px] rounded-full object-cover" />
                  ) : (
                    <span className="text-[22px]">{c.emoji ?? "🎌"}</span>
                  )}
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
                キャンセル
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

/* ═══ 米部 — sekaimura.net/komebu を参考に再構築: 一覧(タップで詳細) / マップ / お知らせ ═══ */
export function KomeSection({ me, myPref }: { me: User | null; myPref: string }) {
  const [tanbo, setTanbo] = useState<any[] | null>(null);
  const [sales, setSales] = useState<any[]>([]); // お米販売(旧サイトから移行)
  const [newsRows, setNewsRows] = useState<any[]>([]); // 米部お知らせ(旧サイトから移行)
  const [saleOpen, setSaleOpen] = useState<string | null>(null); // こだわりを開いた販売
  const [listPref, setListPref] = useState(""); // 田んぼ一覧の県フィルタ
  const [tab, setTab] = useState<"list" | "map" | "kome" | "news">("list");
  const [sel, setSel] = useState<any | null>(null); // タップした田んぼの詳細
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [tPref, setTPref] = useState(myPref);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mapHost = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => setTPref(myPref), [myPref]);
  const load = useCallback(async () => {
    setTanbo(await fetchTanbo());
    const supabase = createClient();
    const [{ data: ks }, { data: kn }] = await Promise.all([
      supabase.from("kome_sales").select("*").order("sold_out", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("kome_news").select("*").order("created_at", { ascending: false }).limit(60),
    ]);
    setSales(ks ?? []);
    setNewsRows(kn ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const thisYear = (tanbo ?? []).filter((t) => t.year === new Date().getFullYear()).length;

  /* マップタブ: 県の代表点に🌾マーカー */
  useEffect(() => {
    if (tab !== "map" || !tanbo || mapRef.current) return;
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !mapHost.current || mapRef.current) return;
      const map = L.map(mapHost.current, { scrollWheelZoom: false }).setView([36.2, 137.5], 5);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
      for (const t of tanbo) {
        const c = PREF_COORDS[t.prefecture];
        if (!c) continue;
        const jitter = () => (Math.random() - 0.5) * 0.2;
        const mk = L.marker([c[0] + jitter(), c[1] + jitter()], {
          icon: L.divIcon({ className: "", html: `<div style="font-size:20px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🌾</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        })
          .addTo(map)
          .bindPopup(`<b>${t.name}</b><br>${t.prefecture ?? ""}`);
        mk.on("click", () => setSel(t));
      }
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, tanbo]);

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

  /* タップした田んぼの詳細（一覧・マップ共通で下に大きく開く） */
  const detail = sel && (
    <div className="mt-2 overflow-hidden rounded-2xl border-2 border-[#c8b86a] bg-white shadow-md">
      <div className="flex items-center gap-1.5 bg-[#a08a30] px-3 py-1.5 text-[11px] font-extrabold text-white">
        <span>🌾</span>
        <span className="truncate">{sel.prefecture ?? ""}の田んぼ</span>
        <button onClick={() => setSel(null)} className="ml-auto text-[13px] leading-none">×</button>
      </div>
      {sel.photo_url && <img src={srcCdn(sel.photo_url)} alt="" className="h-[160px] w-full object-cover" />}
      <div className="px-3.5 py-3">
        <div className="text-[17px] font-extrabold leading-snug text-[#3a4a34]">{sel.name}</div>
        <div className="mt-0.5 text-[11.5px] text-[#a0aca0]">
          {sel.prefecture ?? ""} ・ 世話人 {sel.profiles?.display_name ?? "—"} ・ {sel.year}年
        </div>
        {sel.note && <div className="mt-1.5 text-[13px] leading-relaxed text-[#5a5448]">{sel.note}</div>}
        <div className="mt-2.5 flex gap-2">
          {me && sel.user_id && sel.user_id !== me.id && (
            <button
              onClick={async () => {
                const chatId = await getOrCreateChat(me.id, sel.user_id);
                if (chatId) {
                  await sendMessage(chatId, me.id, `【米部】田んぼ「${sel.name}」について教えてください！手伝いに行きたいです🌾`);
                  window.location.href = `/talk/${chatId}`;
                }
              }}
              className="flex-1 rounded-xl bg-[#a08a30] py-2.5 text-center text-[13px] font-extrabold text-white"
            >
              世話人にTALKで連絡 →
            </button>
          )}
          {sel.profiles?.username && (
            <a href={`/u/${sel.profiles.username}`} className="flex-1 rounded-xl border-2 border-[#a08a30] py-2.5 text-center text-[13px] font-extrabold text-[#a08a30] no-underline">
              世話人のページ →
            </a>
          )}
        </div>
      </div>
    </div>
  );

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

      {/* タブ: 一覧 / マップ / お知らせ（sekaimura.net/komebu と同じ3本柱） */}
      <div className="mb-2 flex gap-1 rounded-xl bg-[#f2efe2] p-1">
        {([["list", "🌾 田んぼ"], ["map", "🗾 マップ"], ["kome", "🍚 お米を買う"], ["news", "📢 お知らせ"]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); setSel(null); }}
            className="flex-1 rounded-lg py-1.5 text-[11.5px] font-extrabold"
            style={tab === k ? { background: "#a08a30", color: "#fff" } : { color: "#8a8060" }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 一覧 ── */}
      {tab === "list" && (
        <>
          {tanbo === null ? (
            <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>
          ) : tanbo.length === 0 ? (
            <p className="py-2 text-[12px] text-[#a0aca0]">まだ田んぼが登録されていません</p>
          ) : (
            <div className="space-y-2">
              <select
                value={listPref}
                onChange={(e) => setListPref(e.target.value)}
                className="w-full rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[13px] font-bold text-[#8a7020] outline-none"
              >
                <option value="">全国の田んぼ（{tanbo.length}）</option>
                {[...new Set(tanbo.map((t) => t.prefecture).filter(Boolean))].map((pf) => (
                  <option key={pf} value={pf}>{pf}（{tanbo.filter((t) => t.prefecture === pf).length}）</option>
                ))}
              </select>
              {tanbo.filter((t) => !listPref || t.prefecture === listPref).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSel(sel?.id === t.id ? null : t)}
                  className="flex w-full items-center gap-2.5 rounded-xl border bg-white p-2 text-left"
                  style={{ borderColor: sel?.id === t.id ? "#a08a30" : "#eef2ec" }}
                >
                  {t.photo_url ? (
                    <img src={srcCdn(t.photo_url)} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#f2f4ea] text-xl">🌾</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-[#3a4a34]">{t.name}</div>
                    <div className="text-[10.5px] text-[#a0aca0]">
                      {t.prefecture} ・ {t.profiles?.display_name ?? ""}
                    </div>
                    {t.note && <div className="truncate text-[11px] text-[#8a968a]">{t.note}</div>}
                  </div>
                  <span className="flex-shrink-0 text-[11px] text-[#c0b890]">{sel?.id === t.id ? "▲" : "▼ 詳細"}</span>
                </button>
              ))}
            </div>
          )}
          {detail}
        </>
      )}

      {/* ── マップ ── */}
      {tab === "map" && (
        <>
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <div ref={mapHost} className="h-[300px] w-full overflow-hidden rounded-xl border border-[#e8e2cc]" data-noswipe />
          <p className="mt-1 text-center text-[10px] text-[#a0aca0]">🌾を押すと下に詳細が開きます（位置は県の代表点）</p>
          {detail}
        </>
      )}

      {/* ── 🍚 お米を買う（旧サイトの販売情報を全部移行・デザイン刷新） ── */}
      {tab === "kome" && (
        <div className="space-y-3">
          {sales.length === 0 ? (
            <p className="py-2 text-[12px] text-[#a0aca0]">いま販売中のお米はありません</p>
          ) : (
            sales.map((k) => (
              <div key={k.id} className="overflow-hidden rounded-2xl border border-[#e4dcc0] bg-white shadow-sm">
                {(k.image_urls?.[0]) && (
                  <div className="relative">
                    <img src={k.image_urls[0]} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[150px] w-full object-cover" />
                    <span
                      className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white"
                      style={{ background: k.sold_out ? "#8a8070" : "#2a8a4a" }}
                    >
                      {k.sold_out ? "売り切れ" : "販売中"}
                    </span>
                    <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                      {k.prefecture}{k.municipality ? ` ${k.municipality}` : ""}
                    </span>
                  </div>
                )}
                <div className="px-3.5 py-3">
                  <div className="text-[16px] font-extrabold leading-snug text-[#3a3428]">
                    {k.variety}{k.amount_kg ? `（${k.amount_kg}kg）` : ""}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#8a8060]">生産者：{k.farm_name}{k.contact_person ? `（${k.contact_person}さん）` : ""}</div>
                  <div className="num mt-1 text-[15px] font-extrabold text-[#a05030]">
                    {k.price_yen?.toLocaleString()}円{k.shipping_yen ? <span className="text-[11px] font-bold text-[#a09888]">（送料 {k.shipping_yen}円）</span> : null}
                  </div>
                  {(k.features || k.cultivation || k.thoughts) && (
                    <button onClick={() => setSaleOpen(saleOpen === k.id ? null : k.id)} className="mt-1.5 text-[11px] font-bold text-[#8a7020] underline">
                      {saleOpen === k.id ? "▾ とじる" : "▸ 生産者のこだわりを読む"}
                    </button>
                  )}
                  {saleOpen === k.id && (
                    <div className="mt-1.5 space-y-1.5 rounded-xl bg-[#faf7ec] p-2.5 text-[12px] leading-relaxed text-[#5a5030]">
                      {k.features && <p>【特徴】{k.features}</p>}
                      {k.cultivation && <p>【栽培】{k.cultivation}</p>}
                      {k.production && <p>【生産量】{k.production}</p>}
                      {k.thoughts && <p>【想い】{k.thoughts}</p>}
                      {k.message && <p>【米部へ】{k.message}</p>}
                      {k.farmer_image && <img src={k.farmer_image} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-1 w-full rounded-lg object-cover" />}
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {k.website_url && (
                      <a href={k.website_url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl bg-[#a08a30] py-2.5 text-center text-[12.5px] font-extrabold text-white no-underline">
                        🛒 販売ページへ →
                      </a>
                    )}
                    {k.email && (
                      <a href={`mailto:${k.email}`} className="flex-1 rounded-xl border-2 border-[#a08a30] py-2.5 text-center text-[12.5px] font-extrabold text-[#a08a30] no-underline">
                        ✉ メールで注文
                      </a>
                    )}
                    {k.phone && (
                      <a href={`tel:${k.phone}`} className="rounded-xl border border-[#d8d0b0] px-3 py-2.5 text-center text-[12.5px] font-bold text-[#8a8060] no-underline">
                        📞
                      </a>
                    )}
                    {k.instagram_url && (
                      <a href={k.instagram_url} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#d8d0b0] px-3 py-2.5 text-[12.5px] no-underline">📷</a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          <p className="text-center text-[9.5px] leading-relaxed text-[#b0a890]">
            掲載情報は生産者からの提供に基づいています。購入・連絡のやり取りは各自ご注意ください
          </p>
        </div>
      )}

      {/* ── 📢 お知らせ（旧サイトの22件 + 新規登録の自動フィード） ── */}
      {tab === "news" && (
        <div className="space-y-2.5">
          {newsRows.map((nr) => (
            <div key={nr.id} className="border-b border-[#eee8d8] pb-2">
              <div className="text-[12.5px] font-extrabold text-[#5a5030]">{nr.title}</div>
              {nr.content && <div className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#8a8060]">{nr.content}</div>}
              <div className="num mt-0.5 text-[9.5px] text-[#b8b090]">
                {nr.created_at ? new Date(nr.created_at).toLocaleDateString("ja-JP") : ""}
              </div>
            </div>
          ))}
          <div className="pb-1 text-left">
            <div className="text-[12.5px] font-extrabold text-[#5a5030]">米部について</div>
            <div className="mt-0.5 text-[11.5px] leading-relaxed text-[#8a8060]">
              2025年、セカイムラ米部は全国75枚の田んぼを蘇らせました。今年も田んぼごとに仲間が集まって、田植えから収穫までを一緒にやっていきます。
            </div>
          </div>
        </div>
      )}

      {me &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-[#c8b86a88] bg-[#fbf9f0] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#8a7020]">🌾 田んぼを登録する</div>
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
              {photo && <img src={srcCdn(photo)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
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
                キャンセル
              </button>
              <button
                onClick={save}
                disabled={!name.trim() || saving || uploading}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#a08a30" }}
              >
                {saving ? "登録中..." : "登録する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#c8b86a88", color: "#8a7020" }}
          >
            🌾 うちの田んぼを米部に登録する（みんなが手伝いに来ます）
          </button>
        ))}
    </section>
  );
}

/* ═══ 神社町 ═══ */
export function JinjaSection({ me, myPref }: { me: User | null; myPref: string }) {
  const [misoka] = useState(() => nextMisoka());
  const [reports, setReports] = useState<any[] | null>(null);
  const [selJ, setSelJ] = useState<any | null>(null); // タップした報告の詳細
  const [jPaste, setJPaste] = useState("");
  const [jResolving, setJResolving] = useState(false);
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
          <img src="/icons/icon-torii.webp" alt="" style={{ width: 16, height: 16, display: "inline", verticalAlign: -3 }} /> セカイムラ神社町
        </span>
        <span className="text-[10px] text-[#a0aca0]">ミソカの日、近所の神社をそうじする</span>
      </div>

      <div className="mb-2.5 flex items-center gap-3 rounded-xl bg-[#f4f0e8] px-3.5 py-2.5">
        <img src="/icons/icon-broom.webp" alt="" style={{ width: 28, height: 28 }} />
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
            <button key={r.id} onClick={() => setSelJ(selJ?.id === r.id ? null : r)} className="flex w-full items-center gap-2.5 rounded-xl border bg-white p-2 text-left" style={{ borderColor: selJ?.id === r.id ? "#b08a30" : "#eef2ec" }}>
              {r.photo_url ? (
                <img src={srcCdn(r.photo_url)} alt="" className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#f4f0e8] text-xl">
                  <img src="/icons/icon-torii.webp" alt="" style={{ width: 28, height: 28, display: "inline", verticalAlign: -5 }} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-[#3a4a34]">{r.shrine}</div>
                <div className="text-[10.5px] text-[#a0aca0]">
                  {r.prefecture ?? ""} ・ {r.profiles?.display_name ?? ""}
                </div>
                {r.note && <div className="truncate text-[11px] text-[#8a968a]">{r.note}</div>}
              </div>
            </button>
          ))}
          {selJ && (
            <div className="overflow-hidden rounded-2xl border-2 border-[#c8a860] bg-white shadow-md">
              <div className="flex items-center gap-1.5 bg-[#b08a30] px-3 py-1.5 text-[11px] font-extrabold text-white">
                <img src="/icons/icon-torii.webp" alt="" style={{ width: 14, height: 14 }} />
                <span>そうじの報告</span>
                <button onClick={() => setSelJ(null)} className="ml-auto text-[13px] leading-none">×</button>
              </div>
              {selJ.photo_url && <img src={srcCdn(selJ.photo_url)} alt="" className="h-[180px] w-full object-cover" />}
              <div className="px-3.5 py-3">
                <div className="text-[16px] font-extrabold leading-snug text-[#3a4a34]">{selJ.shrine}</div>
                <div className="mt-0.5 text-[11.5px] text-[#a0aca0]">
                  {selJ.prefecture ?? ""} ・ {selJ.profiles?.display_name ?? ""} ・ {selJ.created_at ? new Date(selJ.created_at).toLocaleDateString("ja-JP") : ""}
                </div>
                {selJ.note && <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[#5a5448]">{selJ.note}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {me &&
        (adding ? (
          <div className="mt-3 rounded-xl border border-[#c8b86a88] bg-[#fbf9f0] p-3">
            <div className="mb-2 text-[12.5px] font-extrabold text-[#8a7020]"><img src="/icons/icon-torii.webp" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> そうじの奉告</div>
            <div className="mb-2 flex gap-2">
              <input
              value={jPaste}
              onChange={async (e) => {
                const v = e.target.value;
                setJPaste(v);
                const mu = v.match(/https?:\/\/[^\s]+/);
                if (!mu || jResolving) return;
                setJResolving(true);
                try {
                  const r = await fetch("/api/reco/resolve?url=" + encodeURIComponent(mu[0]));
                  const d = r.ok ? await r.json() : {};
                  if (d.name) setShrine(String(d.name).slice(0, 60));
                  if (d.image && !photo) setPhoto(d.image as string);
                  setJPaste("");
                } catch {}
                setJResolving(false);
              }}
              placeholder="⛩ Googleで神社を検索 → 共有リンクを貼ると名前が自動で入ります"
              className="mb-2 w-full rounded-xl border border-[#2CB7DE55] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#2CB7DE]"
            />
            {jResolving && <p className="mb-1 text-[11px] text-[#2CB7DE]">読み取り中…</p>}
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
              {photo && <img src={srcCdn(photo)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
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
                キャンセル
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
            <img src="/icons/icon-broom.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -3 }} /> そうじを奉告する
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
                        router.push(`/talk/${chatId}`);
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
                キャンセル
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
    fetchVillages(null).then(async (list) => {
      // 現在地(onesea-pos)から近い順に並べる。座標は県の代表点(municipalities先頭)
      try {
        const pos = JSON.parse(localStorage.getItem("onesea-pos") ?? "null");
        if (pos && typeof pos.lat === "number") {
          const muni = await fetch("/data-municipalities.json").then((r) => r.json());
          const center = (pref: string | null) => {
            const arr = pref ? muni[pref] : null;
            return arr && arr[0] ? { lat: arr[0][1], lng: arr[0][2] } : null;
          };
          const dist = (v: Village) => {
            const c = center(v.prefecture);
            if (!c) return 9e9;
            const dx = (c.lng - pos.lon) * Math.cos((pos.lat * Math.PI) / 180);
            const dy = c.lat - pos.lat;
            return dx * dx + dy * dy;
          };
          list = [...list].sort((a, b) => dist(a) - dist(b));
        }
      } catch {}
      setVillages(list);
    });
  }, []);
  if (villages === null) return <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>;
  return <SekaiMap villages={villages} />;
}

/* ═══ 🌱 村の種 — 3人集まったら事務局へ拠点申請できる予備軍 ═══ */
export function SeedSection({ me }: { me: User | null }) {
  const [isOffice, setIsOffice] = useState(false);
  useEffect(() => {
    if (!me) return;
    const supabase = createClient();
    supabase.from("talk_admins").select("user_id").eq("user_id", me.id).maybeSingle().then(({ data }) => setIsOffice(!!data));
  }, [me]);
  const [seeds, setSeeds] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState<null | boolean>(null); // null=未チェック true=使える false=欠番
  const [checking, setChecking] = useState(false);
  const [pref, setPref] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [up, setUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("village_seeds")
      .select("id, name, prefecture, city, cover_url, status, created_by, village_seed_members(user_id)")
      .order("created_at", { ascending: false })
      .limit(30);
    setSeeds(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const checkName = async () => {
    if (!name.trim() || checking) return;
    setChecking(true);
    const supabase = createClient();
    const { data } = await supabase.rpc("village_name_taken", { nm: name.trim() });
    setChecking(false);
    setChecked(data === false);
  };

  const plant = async () => {
    if (!me || saving || checked !== true) return;
    setSaving(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("village_seeds")
      .insert({ name: name.trim(), prefecture: pref || null, cover_url: cover, created_by: me.id })
      .select("id")
      .single();
    if (!error && data) {
      await supabase.from("village_seed_members").insert({ seed_id: data.id, user_id: me.id });
      setName(""); setChecked(null); setCover(null); setOpen(false);
      load();
    } else {
      setMsg(error?.message?.includes("row-level") ? "種をまけるのは、マイページ登録済みのわらわ〜会員だけです" : "保存できませんでした");
    }
    setSaving(false);
  };

  const joinSeed = async (seedId: string) => {
    if (!me) return;
    const supabase = createClient();
    const { error } = await supabase.from("village_seed_members").insert({ seed_id: seedId, user_id: me.id });
    if (error) setMsg("賛同できるのは、マイページ登録済みのわらわ〜会員だけです");
    load();
  };

  const applyOffice = async (seedId: string) => {
    const supabase = createClient();
    await supabase.from("village_seeds").update({ status: "applied" }).eq("id", seedId);
    load();
  };

  return (
    <div className="mx-2 mb-2 rounded-2xl border border-[#d8e4d0] bg-[#f6faf4] p-3">
      <div className="mb-1 text-[12.5px] font-extrabold" style={{ color: GREEN }}>
        <img src="/icons/icon-sprout.webp" alt="" style={{ width: 15, height: 15, display: "inline", verticalAlign: -2.5 }} /> 村を作る
      </div>
      <p className="mb-2 text-[10.5px] leading-relaxed text-[#7a8a74]">
        3人以上で申請し、事務局に認められた場合、他のメンバーを募集できます。
      </p>

      {seeds.length > 0 && (
        <div className="hide-scrollbar mb-2 flex gap-2 overflow-x-auto pb-1">
          {seeds.map((sd) => {
            const n = sd.village_seed_members?.length ?? 0;
            const left = Math.max(0, 3 - n);
            const mine = me && sd.village_seed_members?.some((x: any) => x.user_id === me.id);
            return (
              <div key={sd.id} className="w-[150px] flex-shrink-0 overflow-hidden rounded-2xl border border-[#dce8d8] bg-white shadow-sm">
                <div className="h-[76px] bg-[#eaf2ea]">
                  {sd.cover_url ? (
                    <img src={srcCdn(sd.cover_url)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ background: "linear-gradient(150deg,#d8ecd0,#a8cca0)" }}>
                      <img src="/icons/icon-sprout.webp" alt="" style={{ width: 26, height: 26 }} />
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <div className="truncate text-[11.5px] font-extrabold" style={{ color: GREEN }}>{sd.name}</div>
                  <div className="text-[9.5px] text-[#a0aca0]">{sd.prefecture ?? ""} ・ {n}人</div>
                  {sd.status === "applied" ? (
                    isOffice ? (
                      <button
                        onClick={async () => {
                          const supabase = createClient();
                          const { error } = await supabase.rpc("promote_seed", { seed: sd.id });
                          if (error) setMsg("昇格できませんでした: " + error.message);
                          load();
                        }}
                        className="mt-1 w-full rounded bg-[#1e4530] py-1 text-[9.5px] font-extrabold text-white"
                      >事務局承認 → 村に昇格</button>
                    ) : (
                      <div className="mt-1 rounded bg-[#f0e8d0] px-1.5 py-0.5 text-center text-[9.5px] font-bold text-[#8a7020]">事務局審査中</div>
                    )
                  ) : left > 0 ? (
                    <div className="mt-1 text-[9.5px] font-bold text-[#c07a30]">あと{left}人で拠点申請できます</div>
                  ) : me && sd.created_by === me.id ? (
                    <button onClick={() => applyOffice(sd.id)} className="mt-1 w-full rounded bg-[#c94d3a] py-1 text-[9.5px] font-extrabold text-white">
                      事務局へ拠点申請する
                    </button>
                  ) : (
                    <div className="mt-1 text-[9.5px] font-bold" style={{ color: GREEN }}>3人そろいました！</div>
                  )}
                  {me && !mine && sd.status !== "applied" && (
                    <button onClick={() => joinSeed(sd.id)} className="mt-1 w-full rounded border border-[#4a9a5a] py-1 text-[9.5px] font-extrabold" style={{ color: GREEN }}>
                      一緒に作りたい
                    </button>
                  )}
                  {mine && <div className="mt-1 text-center text-[9px] text-[#a0aca0]">✓ 賛同済み</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {msg && <p className="mb-1 text-[10.5px] font-bold text-[#c05030]">{msg}</p>}

      <button onClick={() => setOpen((v) => !v)} className="w-full rounded-xl border-2 border-dashed border-[#a8cca0] bg-white py-2 text-[11.5px] font-extrabold" style={{ color: GREEN }}>
        {open ? "▾ とじる" : "一緒に拠点を立ち上げる村長を募集する（村長3人が揃うと事務局に村作りの申請が出来ます）"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-white p-2.5">
          <div className="mb-1 text-[11px] font-extrabold text-[#5a6a54]">① 拠点名を決める</div>
          <p className="mb-1.5 text-[9.5px] leading-relaxed text-[#8a9a84]">
            畑や田んぼにはあまり興味が無く、都会で集まりたい人は「トカイムラ○○」をお使いください。
            畑や田んぼなど自給自足に興味がある村を作る際は「セカイムラ○○」をお使いください。
            既に使われているセカイムラ○○県がある場合は使えませんので、セカイムラ○○市やトカイムラ○○市となります。
          </p>
          <div className="flex gap-1.5">
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setChecked(null); }}
              placeholder="例: トカイムラ那覇 / セカイムラ京都"
              className="min-w-0 flex-1 rounded-lg border border-[#d8e4d0] px-2.5 py-2 text-[12px] outline-none focus:border-[#4a9a5a]"
            />
            <button onClick={checkName} disabled={!name.trim() || checking} className="flex-shrink-0 rounded-lg px-2.5 py-2 text-[10.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#4a9a5a" }}>
              {checking ? "確認中" : "使われている拠点名かをチェックします"}
            </button>
          </div>
          {checked === false && <p className="mt-1 text-[10px] font-bold text-[#c05030]">この名前はすでに使われています（永久欠番）。市町村名などで変えてみてください</p>}
          {checked === true && (
            <>
              <p className="mt-1 text-[10px] font-bold" style={{ color: GREEN }}>「{name.trim()}」は使えます！</p>
              <div className="mt-2 mb-1 text-[11px] font-extrabold text-[#5a6a54]">② 集まる場所の写真（古民家・アパートなど）</div>
              <label className="block cursor-pointer rounded-lg border border-dashed border-[#a8cca0] py-2 text-center text-[10.5px] font-bold" style={{ color: GREEN }}>
                {up ? "アップ中..." : cover ? "✓ 写真を設定しました（変更）" : "写真を選ぶ（あとからでもOK）"}
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !me) return;
                  setUp(true);
                  try { setCover(await uploadImage("post-images", me.id, f, 1600, 0.75)); } catch {}
                  setUp(false);
                }} />
              </label>
              <input value={pref} onChange={(e) => setPref(e.target.value)} placeholder="都道府県（例: 沖縄県）" className="mt-2 w-full rounded-lg border border-[#d8e4d0] px-2.5 py-2 text-[12px] outline-none focus:border-[#4a9a5a]" />
              <button onClick={plant} disabled={saving} className="mt-2 w-full rounded-xl py-2.5 text-[12.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#c94d3a" }}>
                {saving ? "まいています..." : "🌱 この名前で種をまく（自分が1人目）"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
