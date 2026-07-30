"use client";

import { createClient } from "@/lib/supabase/client";
import { nextMoons } from "@/lib/almanac";
import type { CotozuteProfile } from "./cotozute";

/* ============ 都道府県 ============ */
export const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
] as const;

export const PREF_COORDS: Record<string, [number, number]> = {
  北海道: [43.06, 141.35], 青森県: [40.82, 140.74], 岩手県: [39.7, 141.15], 宮城県: [38.27, 140.87],
  秋田県: [39.72, 140.1], 山形県: [38.24, 140.33], 福島県: [37.75, 140.47], 茨城県: [36.34, 140.45],
  栃木県: [36.57, 139.88], 群馬県: [36.39, 139.06], 埼玉県: [35.86, 139.65], 千葉県: [35.61, 140.12],
  東京都: [35.68, 139.69], 神奈川県: [35.45, 139.64], 新潟県: [37.9, 139.02], 富山県: [36.7, 137.21],
  石川県: [36.59, 136.63], 福井県: [36.07, 136.22], 山梨県: [35.66, 138.57], 長野県: [36.23, 138.18],
  岐阜県: [35.39, 136.72], 静岡県: [34.98, 138.38], 愛知県: [35.18, 136.91], 三重県: [34.73, 136.51],
  滋賀県: [35.0, 135.87], 京都府: [35.02, 135.76], 大阪府: [34.69, 135.5], 兵庫県: [34.69, 135.18],
  奈良県: [34.69, 135.83], 和歌山県: [34.23, 135.17], 鳥取県: [35.5, 134.24], 島根県: [35.47, 133.05],
  岡山県: [34.66, 133.93], 広島県: [34.4, 132.46], 山口県: [34.19, 131.47], 徳島県: [34.07, 134.56],
  香川県: [34.34, 134.04], 愛媛県: [33.84, 132.77], 高知県: [33.56, 133.53], 福岡県: [33.59, 130.4],
  佐賀県: [33.25, 130.3], 長崎県: [32.74, 129.87], 熊本県: [32.79, 130.74], 大分県: [33.24, 131.61],
  宮崎県: [31.91, 131.42], 鹿児島県: [31.56, 130.56], 沖縄県: [26.34, 127.78],
};

/* ============ 百姓マイスター: 100の暮らしの技 ============ */
export const MEISTER_SKILLS: string[] = [
  "米作り", "味噌作り", "醤油作り", "塩作り（海水から）", "ベランダ菜園", "ぬか漬け", "梅干し作り",
  "梅酒・梅シロップ", "麹おこし", "甘酒作り", "納豆作り", "豆腐作り", "こんにゃく作り", "パン作り（天然酵母）",
  "うどん・そば打ち", "餅つき", "燻製作り", "干物作り", "梅雨の保存食", "らっきょう漬け", "キムチ作り",
  "ピクルス作り", "ジャム作り", "干し柿作り", "切り干し大根", "お茶摘み・製茶", "コーヒー焙煎", "はちみつ採取（養蜂）",
  "鶏の世話・採卵", "ヤギ・羊の世話", "堆肥作り", "ぼかし肥料作り", "種取り・自家採種", "苗作り", "接ぎ木",
  "剪定", "竹細工", "藁細工（しめ縄）", "木綿から糸紡ぎ", "草木染め", "機織り", "裁縫・繕い物",
  "編み物", "刺し子", "草履・わらじ作り", "石鹸作り", "蜜蝋ラップ作り", "アロマ・ハーブ蒸留", "ハーブ栽培",
  "薬草の見分け方", "野草料理", "きのこの見分け方", "山菜採り", "釣り", "さばき方（魚）", "鶏の捌き方",
  "狩猟・ジビエ処理", "火起こし（マッチなし）", "焚き火の作法", "炭焼き", "薪割り", "ロケットストーブ作り",
  "かまど炊飯", "土窯でピザ・パン", "井戸掘り", "雨水利用", "浄水（自然ろ過）", "コンポストトイレ",
  "古民家の掃除・養生", "壁塗り（漆喰・土壁）", "畳の手入れ", "障子・襖の張替え", "大工仕事の基本", "電動工具の使い方",
  "小屋作り", "石積み", "水路の手入れ", "田んぼの畦塗り", "草刈り（鎌・刈払機）", "チェーンソーの使い方",
  "自転車の修理", "刃物研ぎ", "ロープワーク", "テント・野営", "地図読み・方位", "星の見方", "月の満ち欠けと暮らし",
  "天気を読む", "防災の備え", "応急手当", "お灸・指圧の基本", "発酵風呂・薬草風呂", "太鼓・祭囃子", "盆踊り",
  "神社の作法", "餅まき・祭りの運営", "子どもの遊び伝承", "昔話の語り", "手紙を書く", "農閑期の保存計画", "ご近所付き合いの知恵",
];

/* ============ 集い（満月会・新月会） ============ */
export interface Moot {
  kind: "new" | "full";
  dateKey: string; // YYYY-MM-DD (JST)
  label: string;
  dday: number;
}

export function upcomingMoots(count = 4): Moot[] {
  const events = nextMoons(count + 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return events.slice(0, count).map((ev) => {
    const d = new Date(ev.time + 9 * 3600000);
    const dateKey = d.toISOString().slice(0, 10);
    const local = new Date(dateKey + "T00:00:00");
    const dday = Math.round((local.getTime() - today.getTime()) / 86400000);
    return {
      kind: ev.type,
      dateKey,
      label: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`,
      dday,
    };
  });
}

/** 次のミソカ（晦日）= 次の新月の前日 */
export function nextMisoka(): { dateKey: string; label: string; dday: number } {
  const news = nextMoons(3).filter((m) => m.type === "new");
  const d = new Date(news[0].time + 9 * 3600000 - 86400000);
  const dateKey = d.toISOString().slice(0, 10);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const local = new Date(dateKey + "T00:00:00");
  const dday = Math.round((local.getTime() - today.getTime()) / 86400000);
  return { dateKey, label: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`, dday };
}

export async function fetchMootData(dates: string[], userId: string | null) {
  const supabase = createClient();
  const { data } = await supabase.from("moot_rsvps").select("moot_date, user_id").in("moot_date", dates);
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  for (const r of data ?? []) {
    counts.set(r.moot_date, (counts.get(r.moot_date) ?? 0) + 1);
    if (userId && r.user_id === userId) mine.add(r.moot_date);
  }
  return { counts, mine };
}

export async function toggleRsvp(userId: string, dateKey: string, kind: "new" | "full", isRsvped: boolean) {
  const supabase = createClient();
  if (isRsvped) await supabase.from("moot_rsvps").delete().eq("user_id", userId).eq("moot_date", dateKey);
  else await supabase.from("moot_rsvps").insert({ user_id: userId, moot_date: dateKey, kind });
}

/** 自分の集い参加回数（信頼の節目: 1回で投稿、3回で創設系が開く） */
export async function myMootCount(userId: string): Promise<number> {
  const supabase = createClient();
  const { count } = await supabase
    .from("moot_rsvps")
    .select("moot_date", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("moot_date", new Date().toISOString().slice(0, 10));
  return count ?? 0;
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.from("sekai_settings").select("key, value");
  const map: Record<string, string> = {};
  for (const r of data ?? []) map[r.key] = r.value ?? "";
  return map;
}

/* ============ 型 ============ */
export type P = CotozuteProfile & { username: string | null };

export interface Village {
  id: string;
  name: string;
  prefecture: string;
  description: string | null;
  policy: "open" | "approval" | "invite" | "paused" | "full";
  created_by: string | null;
  profiles: P | null;
  village_members: Array<{ count: number }>;
}

export interface Club {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  scope: string;
  is_official: boolean;
  created_by: string | null;
  club_members: Array<{ count: number }>;
}

export const POLICY_LABEL: Record<Village["policy"], string> = {
  open: "誰でも参加OK",
  approval: "申請・承認制",
  invite: "招待制",
  paused: "一時募集停止",
  full: "満員",
};

/* ============ ラウンジ ============ */
export async function fetchLounge(pref: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("lounge_posts")
    .select("id, body, created_at, user_id, profiles!lounge_posts_user_id_fkey(username, display_name, avatar_url)")
    .eq("prefecture", pref)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function postLounge(userId: string, pref: string, body: string) {
  const supabase = createClient();
  return supabase.from("lounge_posts").insert({ user_id: userId, prefecture: pref, body });
}

export async function villagersOf(pref: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, status_line")
    .eq("prefecture", pref)
    .not("username", "is", null)
    .limit(24);
  return data ?? [];
}

/** 最近入った村人（放置ゼロ: 歓迎を送る対象） */
export async function recentVillagers(days = 30) {
  const supabase = createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, prefecture, created_at")
    .gte("created_at", since)
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(12);
  return data ?? [];
}

/* ============ 拠点（村） ============ */
const VILLAGE_SELECT =
  "id, name, prefecture, description, policy, created_by, profiles!villages_created_by_fkey(username, display_name, avatar_url), village_members(count)";

export async function fetchVillages(pref?: string | null): Promise<Village[]> {
  const supabase = createClient();
  let q = supabase.from("villages").select(VILLAGE_SELECT).order("created_at", { ascending: false }).limit(60);
  if (pref) q = q.eq("prefecture", pref);
  const { data } = await q;
  return (data as unknown as Village[]) ?? [];
}

export async function createVillage(
  userId: string,
  v: { name: string; prefecture: string; description: string; policy: Village["policy"] }
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("villages")
    .insert({ ...v, created_by: userId })
    .select("id")
    .single();
  if (data) await supabase.from("village_members").insert({ village_id: data.id, user_id: userId });
  return { id: data?.id, error };
}

export async function joinVillage(userId: string, villageId: string) {
  const supabase = createClient();
  return supabase.from("village_members").insert({ village_id: villageId, user_id: userId });
}

export async function myVillageIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("village_members").select("village_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.village_id as string));
}

/* ============ 部活動 ============ */
const CLUB_SELECT = "id, name, emoji, description, scope, is_official, created_by, club_members(count)";

export async function fetchClubs(): Promise<Club[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("clubs")
    .select(CLUB_SELECT)
    .order("is_official", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(60);
  return (data as unknown as Club[]) ?? [];
}

export async function createClub(userId: string, c: { name: string; emoji: string; description: string; scope: string }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clubs")
    .insert({ ...c, created_by: userId })
    .select("id")
    .single();
  if (data) await supabase.from("club_members").insert({ club_id: data.id, user_id: userId });
  return { id: data?.id, error };
}

export async function joinClub(userId: string, clubId: string) {
  const supabase = createClient();
  return supabase.from("club_members").insert({ club_id: clubId, user_id: userId });
}

export async function leaveClub(userId: string, clubId: string) {
  const supabase = createClient();
  return supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", userId);
}

export async function myClubIds(userId: string): Promise<Set<string>> {
  const supabase = createClient();
  const { data } = await supabase.from("club_members").select("club_id").eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.club_id as string));
}

/* ============ 米部 ============ */
export async function fetchTanbo() {
  const supabase = createClient();
  const { data } = await supabase
    .from("tanbo")
    .select("id, name, prefecture, note, photo_url, year, user_id, profiles!tanbo_user_id_fkey(username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(60);
  return data ?? [];
}

export async function addTanbo(
  userId: string,
  t: { name: string; prefecture: string; note: string; photo_url: string | null }
) {
  const supabase = createClient();
  return supabase.from("tanbo").insert({ ...t, user_id: userId, year: new Date().getFullYear() });
}

/* ============ 神社町 ============ */
export async function fetchJinja() {
  const supabase = createClient();
  const { data } = await supabase
    .from("jinja_reports")
    .select("id, shrine, prefecture, note, photo_url, created_at, user_id, profiles!jinja_reports_user_id_fkey(username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function addJinja(
  userId: string,
  j: { shrine: string; prefecture: string; note: string; photo_url: string | null }
) {
  const supabase = createClient();
  return supabase.from("jinja_reports").insert({ ...j, user_id: userId });
}

/* ============ 百姓マイスター ============ */
export async function fetchMeister(userId: string | null) {
  const supabase = createClient();
  const { data } = await supabase.from("meister_marks").select("skill_id, kind, user_id");
  const can = new Map<number, number>();
  const want = new Map<number, number>();
  const mineCan = new Set<number>();
  const mineWant = new Set<number>();
  for (const r of data ?? []) {
    if (r.kind === "can") {
      can.set(r.skill_id, (can.get(r.skill_id) ?? 0) + 1);
      if (userId && r.user_id === userId) mineCan.add(r.skill_id);
    } else {
      want.set(r.skill_id, (want.get(r.skill_id) ?? 0) + 1);
      if (userId && r.user_id === userId) mineWant.add(r.skill_id);
    }
  }
  return { can, want, mineCan, mineWant };
}

export async function toggleMeister(userId: string, skillId: number, kind: "can" | "want", has: boolean) {
  const supabase = createClient();
  if (has)
    await supabase.from("meister_marks").delete().eq("user_id", userId).eq("skill_id", skillId).eq("kind", kind);
  else await supabase.from("meister_marks").insert({ user_id: userId, skill_id: skillId, kind });
}

export async function meisterTeachers(skillId: number) {
  const supabase = createClient();
  const { data } = await supabase
    .from("meister_marks")
    .select("profiles!meister_marks_user_id_fkey(username, display_name, avatar_url)")
    .eq("skill_id", skillId)
    .eq("kind", "can")
    .limit(12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
}

/* ============ 助けて掲示板 ============ */
export async function fetchTasukete() {
  const supabase = createClient();
  const { data } = await supabase
    .from("tasukete")
    .select("id, title, body, prefecture, reward, closed, created_at, user_id, profiles!tasukete_user_id_fkey(username, display_name, avatar_url)")
    .eq("closed", false)
    .order("created_at", { ascending: false })
    .limit(30);
  return data ?? [];
}

export async function addTasukete(
  userId: string,
  t: { title: string; body: string; prefecture: string; reward: string }
) {
  const supabase = createClient();
  return supabase.from("tasukete").insert({ ...t, user_id: userId });
}

export async function closeTasukete(userId: string, id: string) {
  const supabase = createClient();
  return supabase.from("tasukete").update({ closed: true }).eq("id", id).eq("user_id", userId);
}

/* ============ 統計 ============ */
export async function sekaiStats() {
  const supabase = createClient();
  const [p, v, c, t] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("villages").select("id", { count: "exact", head: true }),
    supabase.from("clubs").select("id", { count: "exact", head: true }),
    supabase.from("tanbo").select("id", { count: "exact", head: true }),
  ]);
  return {
    villagers: p.count ?? 0,
    villages: v.count ?? 0,
    clubs: c.count ?? 0,
    tanbo: t.count ?? 0,
  };
}
