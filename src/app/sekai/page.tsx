"use client";

import { useCallback, useEffect, useState } from "react";
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
  mootFaces,
  todaysVillager,
  toggleRsvp,
  myMootCount,
  fetchSettings,
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
  sekaiStats,
} from "@/lib/sekai";
import { SekaiMap } from "@/components/sekai/SekaiMap";
import { CameraIcon } from "@/components/CameraIcon";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */

const GREEN = "#3a7a4c";
const DARKGREEN_BG = "linear-gradient(165deg,#0e2014 0%,#163522 55%,#1e4530 100%)";

function AvatarSm({ p, size = 34 }: { p: any; size?: number }) {
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

const SectionTitle = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <div className="mb-2.5">
    <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
      {children}
    </span>
    {sub && <span className="ml-2 text-[11px] font-normal text-[#a0aca0]">{sub}</span>}
  </div>
);

export default function SekaiPage() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [myPref, setMyPref] = useState<string>("東京都");
  const [pref, setPref] = useState<string>("東京都");
  const [travelMode, setTravelMode] = useState(false);
  const [stats, setStats] = useState({ villagers: 0, villages: 0, clubs: 0, tanbo: 0 });
  const [mootCount, setMootCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (u) {
        const { data } = await supabase.from("profiles").select("prefecture").eq("id", u.id).maybeSingle();
        if (data?.prefecture && (PREFS as readonly string[]).includes(data.prefecture)) {
          setMyPref(data.prefecture);
          setPref(data.prefecture);
        }
        setMootCount(await myMootCount(u.id));
      }
    });
    sekaiStats().then(setStats);
  }, []);

  return (
    <main className="pb-20">
      {/* ═══ ヒーロー（説明文なし） ═══ */}
      <header className="px-6 pb-7 pt-10 text-center" style={{ background: DARKGREEN_BG }}>
        <div className="text-[52px] leading-none">🌏</div>
        <h1 className="mt-4 text-[24px] font-extrabold leading-snug tracking-[2px] text-[#eaf2e6]">
          世界は一つの村になる。
        </h1>
        <div className="mt-1 text-[30px] font-extrabold tracking-[8px] text-[#eae6b8]">セカイムラ</div>
        <div className="mt-5 flex items-end justify-center gap-7 text-[#a8cca8]">
          <div>
            <div className="num text-[20px] font-extrabold text-[#eaf2e6]">{stats.villagers}</div>
            <div className="text-[9px] tracking-[2px]">村人</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold text-[#eaf2e6]">{stats.villages}</div>
            <div className="text-[9px] tracking-[2px]">拠点</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold text-[#eaf2e6]">{stats.clubs}</div>
            <div className="text-[9px] tracking-[2px]">部活</div>
          </div>
          <div>
            <div className="num text-[20px] font-extrabold text-[#eaf2e6]">{stats.tanbo}</div>
            <div className="text-[9px] tracking-[2px]">田んぼ</div>
          </div>
        </div>
      </header>

      {/* アンカーナビ */}
      <nav
        className="hide-scrollbar sticky top-0 z-40 flex gap-1.5 overflow-x-auto border-b border-[#e2eae0] px-3 py-2"
        style={{ background: "rgba(242,237,228,.97)", backdropFilter: "blur(8px)" }}
      >
        {[
          ["#moots", "🌕 集い"],
          ["#katsudo", "📣 活動報告"],
          ["#lounge", "🗣 ラウンジ"],
          ["#villages", "⛺ 拠点"],
          ["#clubs", "🎌 部活"],
          ["#kome", "🌾 米部"],
          ["#jinja", "⛩ 神社町"],
          ["#meister", "🫙 マイスター"],
          ["#tasukete", "🤝 助けて"],
          ["#map", "🗾 地図"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="flex-shrink-0 rounded-full border border-[#d8e4da] bg-white px-3 py-1.5 text-[11.5px] font-bold no-underline"
            style={{ color: GREEN }}
          >
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-4 px-4 pt-4">
        <MootsSection me={me} myPref={myPref} mootCount={mootCount} onRsvped={() => me && myMootCount(me.id).then(setMootCount)} />
        <ActivitySection me={me} router={router} />
        <WelcomeSection me={me} router={router} />
        <LoungeSection
          me={me}
          pref={pref}
          myPref={myPref}
          travelMode={travelMode}
          onPref={(p, travel) => {
            setPref(p);
            setTravelMode(travel);
          }}
          router={router}
        />
        <VillagesSection me={me} pref={pref} router={router} />
        <ClubsSection me={me} />
        <KomeSection me={me} myPref={myPref} />
        <JinjaSection me={me} myPref={myPref} />
        <MeisterSection me={me} />
        <TasuketeSection me={me} myPref={myPref} router={router} />
        <section id="map" className="card" style={{ scrollMarginTop: 56 }}>
          <SectionTitle>🗾 村の地図 — 旅先でも家族を見つける</SectionTitle>
          <MapLoader />
        </section>
      </div>
    </main>
  );
}

/* ═══ 集い（満月会・新月会） ═══ */
function MootsSection({
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
  const [moots] = useState<Moot[]>(() => upcomingMoots(4));
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [faces, setFaces] = useState<any[]>([]);

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

  useEffect(() => {
    if (moots[0]) mootFaces(moots[0].dateKey).then(setFaces);
  }, [moots, mine]);

  const next = moots[0];

  return (
    <section id="moots" className="card" style={{ background: "linear-gradient(150deg,#0f1a25,#1a2a38)", border: "1px solid #2a4a3a", scrollMarginTop: 56 }}>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px] text-[#7aa88a]">
          🌕 セカイムラの集い
        </span>
        {me && (
          <span className="text-[10px] text-[#5a7a68]">
            あなたの参加 {mootCount}回
          </span>
        )}
      </div>

      {/* 次の集い（大きく） */}
      {next && (
        <div className="mb-2 rounded-xl border border-[#4a9a6a]/40 bg-white/5 p-3.5">
          <div className="flex items-center gap-3.5">
            <div className="text-[40px]">{next.kind === "new" ? "🌑" : "🌕"}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] tracking-[2px] text-[#7aa88a]">
                次の{next.kind === "new" ? "新月会（昼）" : "満月会（夜）"}
              </div>
              <div className="num text-[22px] font-extrabold leading-snug text-[#a8d8b8]">
                {next.label}
                <span className="ml-2 text-[13px] text-[#7aa88a]">
                  {next.dday === 0 ? "今日！" : next.dday === 1 ? "明日" : `あと${next.dday}日`}
                </span>
              </div>
              <div className="num text-[11px] text-[#5a7a68]">{counts.get(next.dateKey) ?? 0}人が集う予定</div>
            </div>
            {me && (
              <button
                onClick={async () => {
                  await toggleRsvp(me.id, next.dateKey, next.kind, mine.has(next.dateKey));
                  await load();
                  onRsvped();
                }}
                className="flex-shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-extrabold"
                style={
                  mine.has(next.dateKey)
                    ? { background: "#2a5a3a", color: "#a8d8b8", border: "1px solid #4a9a6a" }
                    : { background: "#d4b96a", color: "#1a2432" }
                }
              >
                {mine.has(next.dateKey) ? "✓ 集います" : "集います"}
              </button>
            )}
          </div>
          {/* 参加導線 */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {settings.zoom_url ? (
              <a
                href={settings.zoom_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#2d8cff] py-2.5 text-center text-[13px] font-extrabold text-white no-underline"
              >
                Zoom で参加
              </a>
            ) : (
              <div className="rounded-xl border border-white/15 py-2.5 text-center text-[11.5px] text-[#5a7a68]">
                Zoom 準備中
              </div>
            )}
            {settings.youtube_url ? (
              <a
                href={settings.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#f00] py-2.5 text-center text-[13px] font-extrabold text-white no-underline"
              >
                YouTube で視聴
              </a>
            ) : (
              <div className="rounded-xl border border-white/15 py-2.5 text-center text-[11.5px] text-[#5a7a68]">
                YouTube 準備中
              </div>
            )}
          </div>
          {faces.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <div className="flex -space-x-2">
                {faces.slice(0, 8).map((f, i) =>
                  f.avatar_url ? (
                    <img
                      key={i}
                      src={f.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full border-2 border-[#1a2a38] object-cover"
                    />
                  ) : (
                    <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#1a2a38] bg-[#2a4a3a] text-[12px]">
                      🌿
                    </span>
                  )
                )}
              </div>
              <span className="text-[10.5px] text-[#7aa88a]">この顔ぶれと集います</span>
            </div>
          )}
          <div className="mt-2 text-[10.5px] leading-relaxed text-[#5a7a68]">
            終わったあとは {myPref} のブレイクアウトへ。話したい人だけ、そのまま地域ラウンジで。
          </div>
        </div>
      )}

      {/* その先の集い */}
      <div className="grid grid-cols-3 gap-2">
        {moots.slice(1).map((m) => (
          <button
            key={m.dateKey}
            onClick={async () => {
              if (!me) return;
              await toggleRsvp(me.id, m.dateKey, m.kind, mine.has(m.dateKey));
              await load();
              onRsvped();
            }}
            className="rounded-xl border py-2 text-center"
            style={
              mine.has(m.dateKey)
                ? { background: "#2a5a3a", borderColor: "#4a9a6a" }
                : { background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.12)" }
            }
          >
            <div className="text-[18px]">{m.kind === "new" ? "🌑" : "🌕"}</div>
            <div className="num text-[12px] font-bold text-[#a8d8b8]">{m.label}</div>
            <div className="num text-[9.5px] text-[#5a7a68]">
              {counts.get(m.dateKey) ?? 0}人{mine.has(m.dateKey) ? " ✓" : ""}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ═══ 各地の活動報告（村ブログ横断フィード）═══ */
function ActivitySection({ me, router }: { me: User | null; router: ReturnType<typeof useRouter> }) {
  const [feed, setFeed] = useState<any[] | null>(null);
  const [villages, setVillages] = useState<Village[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [myVills, setMyVills] = useState<Village[]>([]);
  const [writing, setWriting] = useState(false);
  const [wVillage, setWVillage] = useState("");
  const [wBody, setWBody] = useState("");
  const [wPhoto, setWPhoto] = useState<string | null>(null);
  const [wUploading, setWUploading] = useState(false);
  const [wSaving, setWSaving] = useState(false);

  const loadFeed = useCallback(() => fetchActivityFeed(10).then((f) => setFeed(f as any[])), []);

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
    await supabase.from("village_posts").insert({ village_id: wVillage, user_id: me.id, body: wBody.trim(), photo_url: wPhoto });
    setWSaving(false);
    setWriting(false);
    setWBody("");
    setWPhoto(null);
    loadFeed();
  };

  const join = async (post: any) => {
    const owner = post.villages?.created_by;
    if (!me || !owner || sent.has(post.id)) return;
    setSent((prev) => new Set(prev).add(post.id));
    const chatId = await getOrCreateChat(me.id, owner === me.id ? post.user_id : owner);
    if (chatId) {
      await sendMessage(chatId, me.id, `「${post.villages?.name}」の活動報告を見ました。参加したいです 🌱`);
      router.push(`/line/${chatId}`);
    }
  };

  return (
    <section id="katsudo" className="card" style={{ scrollMarginTop: 56, border: "1.5px solid #3a7a4c44" }}>
      {/* 見出し */}
      <div
        className="-mx-4 -mt-4 mb-3 px-4 pb-2.5 pt-3.5"
        style={{ background: "linear-gradient(150deg,#163522,#1e4530)", borderRadius: "14px 14px 0 0" }}
      >
        <div className="text-[14px] font-extrabold tracking-[2px] text-[#eae6b8]">📣 各地のセカイムラ いま</div>
        <div className="mt-0.5 text-[10.5px] text-[#8ab89a]">全国の拠点の活動報告 — 今日、村で何があったか</div>
      </div>

      {/* 拠点一覧（横スクロールのチップ） */}
      {villages.length > 0 && (
        <div className="hide-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
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
              {p.photo_url && <img src={p.photo_url} alt="" className="max-h-52 w-full object-cover" />}
              <div className="p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/sekai/village/${p.villages?.id}`}
                    className="min-w-0 truncate text-[13.5px] font-extrabold no-underline"
                    style={{ color: GREEN }}
                  >
                    ⛺ {p.villages?.name ?? "セカイムラ"}
                  </Link>
                  <span className="num flex-shrink-0 text-[10px] text-[#c0c8c0]">
                    {p.villages?.prefecture ?? ""} ・ {new Date(p.created_at).getMonth() + 1}/
                    {new Date(p.created_at).getDate()}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3a4438]">
                  {p.body}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AvatarSm p={p.profiles} size={24} />
                    <span className="text-[10.5px] text-[#a0aca0]">{p.profiles?.display_name ?? "むらびと"}</span>
                  </div>
                  {me && me.id !== (p.villages?.created_by ?? p.user_id) && (
                    <button
                      onClick={() => join(p)}
                      disabled={sent.has(p.id)}
                      className="rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-50"
                      style={{ background: "#4a8a5c" }}
                    >
                      {sent.has(p.id) ? "連絡しました 🌱" : "参加する"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 活動を報告する（自分の村がある人だけ） */}
      {me && myVills.length > 0 && (
        writing ? (
          <div className="mt-3 rounded-xl border border-[#4a8a5c66] bg-[#f7fbf8] p-3">
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
                    setWPhoto(await uploadImage("post-images", me.id, f));
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
                {wSaving ? "報告中..." : "📣 全国に報告する"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setWriting(true)}
            className="mt-3 w-full rounded-xl border-2 border-dashed py-3 text-[13.5px] font-extrabold"
            style={{ borderColor: "#4a8a5c66", color: GREEN }}
          >
            📣 うちの村の活動を報告する
          </button>
        )
      )}

      {/* 拠点を立ち上げる */}
      <a
        href="#villages"
        className="mt-3 block w-full rounded-xl py-3 text-center text-[13.5px] font-extrabold text-white no-underline"
        style={{ background: "linear-gradient(135deg,#4a8a5c,#3a7a4c)" }}
      >
        🔥 これからセカイムラ拠点を立ち上げる
      </a>
    </section>
  );
}

/* ═══ 顔を知る: 今日の村人 + 新しい村人を迎える ═══ */
function WelcomeSection({ me, router }: { me: User | null; router: ReturnType<typeof useRouter> }) {
  const [recent, setRecent] = useState<any[]>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [spotlight, setSpotlight] = useState<any | null>(null);

  useEffect(() => {
    recentVillagers(30).then(setRecent);
    todaysVillager().then(setSpotlight);
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

  if (recent.length === 0 && !spotlight) return null;

  return (
    <section className="card">
      {/* 今日の村人（日替わりスポットライト） */}
      {spotlight && (
        <div
          className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5"
          style={{ background: "linear-gradient(135deg,#fdf8ec,#fffdf8)", border: "1px solid #e8dcb888" }}
        >
          <AvatarSm p={spotlight} size={46} />
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] font-bold tracking-[2px] text-[#c8a030]">🌞 今日の村人</div>
            <div className="truncate text-[13.5px] font-extrabold text-[#3a3428]">
              {spotlight.display_name ?? "むらびと"}
              <span className="ml-1.5 text-[10.5px] font-normal text-[#a0aca0]">{spotlight.prefecture ?? ""}</span>
            </div>
            {(spotlight.status_line || spotlight.bio) && (
              <div className="truncate text-[11px] text-[#8a8070]">{spotlight.status_line ?? spotlight.bio}</div>
            )}
          </div>
          {me && me.id !== spotlight.id && (
            <button
              onClick={async () => {
                const chatId = await getOrCreateChat(me.id, spotlight.id);
                if (chatId) router.push(`/line/${chatId}`);
              }}
              className="flex-shrink-0 rounded-lg px-3 py-2 text-[11.5px] font-extrabold text-white"
              style={{ background: "#c8a030" }}
            >
              話しかける
            </button>
          )}
        </div>
      )}
      {recent.length > 0 && (
      <>
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          🌱 新しい村人
        </span>
        <span className="text-[10px] text-[#a0aca0]">入った人を、ひとりにしない</span>
      </div>
      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {recent.map((p) => (
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
      </>
      )}
    </section>
  );
}

/* ═══ ラウンジ喫茶（常時オープンのビデオ通話）入口 ═══ */
function CafeBar({ pref }: { pref: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    // 見るだけ（track しない）ので在室者にはカウントされない
    const ch = supabase.channel(`cafe:${pref}`);
    ch.on("presence", { event: "sync" }, () => {
      const st = ch.presenceState() as Record<string, Array<{ t?: number }>>;
      setCount(Object.keys(st).filter((k) => st[k][0]?.t !== undefined).length);
    });
    ch.subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pref]);

  return (
    <Link
      href={`/sekai/cafe/${encodeURIComponent(pref)}`}
      className="mb-3 flex items-center gap-3 rounded-xl px-3.5 py-3 no-underline"
      style={{ background: "linear-gradient(135deg,#241c14,#3a2e1e)", border: "1px solid #c8a86055" }}
    >
      <span className="text-[30px]">☕</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-extrabold text-[#f0e2c8]">{pref}ラウンジ喫茶 — 常時オープン</div>
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
      <span
        className="flex-shrink-0 rounded-xl px-3.5 py-2 text-[12px] font-extrabold text-[#241c14]"
        style={{ background: "linear-gradient(135deg,#e8cc90,#c8a860)" }}
      >
        入店する
      </span>
    </Link>
  );
}

/* ═══ 地域ラウンジ + 旅先モード ═══ */
function LoungeSection({
  me,
  pref,
  myPref,
  travelMode,
  onPref,
  router,
}: {
  me: User | null;
  pref: string;
  myPref: string;
  travelMode: boolean;
  onPref: (p: string, travel: boolean) => void;
  router: ReturnType<typeof useRouter>;
}) {
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
function VillagesSection({
  me,
  pref,
  router,
}: {
  me: User | null;
  pref: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [villages, setVillages] = useState<Village[] | null>(null);
  const [mineIds, setMineIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [vPref, setVPref] = useState(pref);
  const [policy, setPolicy] = useState<Village["policy"]>("open");
  const [saving, setSaving] = useState(false);
  const [born, setBorn] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await fetchVillages(null);
    setVillages(list);
    if (me) setMineIds(await myVillageIds(me.id));
  }, [me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setVPref(pref), [pref]);

  const inPref = (villages ?? []).filter((v) => v.prefecture === pref);
  const others = (villages ?? []).filter((v) => v.prefecture !== pref);

  const create = async () => {
    if (!me || !name.trim() || saving) return;
    setSaving(true);
    await createVillage(me.id, { name: name.trim(), prefecture: vPref, description: desc.trim(), policy });
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
              {v.prefecture} ・ {members}人 ・ 世話人 {v.profiles?.display_name ?? "—"}
            </div>
          </Link>
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-bold"
            style={
              v.policy === "open"
                ? { background: "#eaf6ee", color: GREEN }
                : { background: "#f4f0e6", color: "#a08030" }
            }
          >
            {POLICY_LABEL[v.policy]}
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
                世話人に連絡する
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
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: GREEN }}>
          ⛺ {pref}の拠点
        </span>
        <span className="text-[10px] text-[#a0aca0]">一つの県に、いくつでも</span>
      </div>

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
          <div className="text-3xl">🔥</div>
          <p className="mt-1.5 text-[13.5px] font-extrabold" style={{ color: GREEN }}>
            {pref}には、まだ拠点がありません
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#8a968a]">最初の火を、あなたが灯しませんか</p>
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
              🔥 村をつくる
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`例: セカイムラ${vPref.replace(/[都道府県]$/, "")}${inPref.length > 0 ? inPref.length + 1 : ""}`}
              className="mb-2 w-full rounded-xl border border-[#e2eae0] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#4a8a5c]"
            />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <select
                value={vPref}
                onChange={(e) => setVPref(e.target.value)}
                className="rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                {PREFS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <select
                value={policy}
                onChange={(e) => setPolicy(e.target.value as Village["policy"])}
                className="rounded-xl border border-[#e2eae0] bg-white px-2 py-2 text-[13px] outline-none"
              >
                <option value="open">誰でも参加OK</option>
                <option value="approval">申請・承認制</option>
                <option value="invite">招待制</option>
              </select>
            </div>
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
                disabled={!name.trim() || saving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40"
                style={{ background: "#4a8a5c" }}
              >
                {saving ? "灯しています..." : "🔥 この村を灯す"}
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
            🔥 村をつくる
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
function ClubsSection({ me }: { me: User | null }) {
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
          {clubs.map((c) => {
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
function KomeSection({ me, myPref }: { me: User | null; myPref: string }) {
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
                    setPhoto(await uploadImage("post-images", me.id, f));
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
function JinjaSection({ me, myPref }: { me: User | null; myPref: string }) {
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
                    setPhoto(await uploadImage("post-images", me.id, f));
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
function MeisterSection({ me }: { me: User | null }) {
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
function TasuketeSection({ me, myPref, router }: { me: User | null; myPref: string; router: ReturnType<typeof useRouter> }) {
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
function MapLoader() {
  const [villages, setVillages] = useState<Village[] | null>(null);
  useEffect(() => {
    fetchVillages(null).then(setVillages);
  }, []);
  if (villages === null) return <p className="py-2 text-[12px] text-[#a0aca0]">読み込み中...</p>;
  return <SekaiMap villages={villages} />;
}
