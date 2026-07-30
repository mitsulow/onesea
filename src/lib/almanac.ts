import { NODES, SEKKI, KOU } from "./calendar-data";

/** 四至（冬至・春分・夏至・秋分）の黄経 */
const SHISHI = new Set([0, 90, 180, 270]);

export const SHISHI_COLOR: Record<number, string> = {
  270: "#996B1D",
  0: "#2E7D32",
  90: "#C62828",
  180: "#1565C0",
};
export const SHISHI_BG: Record<number, string> = {
  270: "#FFF8E1",
  0: "#E8F5E9",
  90: "#FFEBEE",
  180: "#E3F2FD",
};

export interface NodeEvent {
  deg: number;
  time: string; // "HH:MM" (JST)
  level: 1 | 2 | 3 | 4;
  sekki?: [string, string, string];
  kou?: [string, string, string];
}

function levelOf(deg: number): 1 | 2 | 3 | 4 {
  if (SHISHI.has(deg)) return 4;
  if (SEKKI[deg]) return 3;
  if (KOU[deg]) return 2;
  return 1;
}

/** 日付キー "YYYY-MM-DD" → その日の節分かれつ刻イベント一覧 */
const eventMap: Record<string, NodeEvent[]> = {};
for (const [deg, jst] of NODES) {
  const key = jst.slice(0, 10);
  (eventMap[key] ??= []).push({
    deg,
    time: jst.slice(11),
    level: levelOf(deg),
    sekki: SEKKI[deg],
    kou: KOU[deg],
  });
}

/** その日で最も位の高い節分かれつ刻 */
export function bestOf(dateKey: string): NodeEvent | null {
  const events = eventMap[dateKey];
  if (!events) return null;
  return events.reduce((a, b) => (b.level > a.level ? b : a));
}

const KANJI = [
  "", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十",
];

export const SYNODIC = 29.530588853;

const RAD = Math.PI / 180;

/** 月と太陽の黄経差 0-360°（低精度メーウス式・±0.1日相当） */
export function elongationAt(msUtc: number): number {
  const jd = msUtc / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const Ms = (357.5291092 + 35999.0502909 * T) * RAD;
  const Mm = (134.9633964 + 477198.8675055 * T) * RAD;
  const Dm = (297.8501921 + 445267.1114034 * T) * RAD;
  const Lm =
    218.3164477 + 481267.88123421 * T +
    6.289 * Math.sin(Mm) - 1.274 * Math.sin(Mm - 2 * Dm) +
    0.658 * Math.sin(2 * Dm) - 0.214 * Math.sin(2 * Mm) - 0.11 * Math.sin(Dm);
  const Ls = 280.46646 + 36000.76983 * T + 1.915 * Math.sin(Ms) + 0.02 * Math.sin(2 * Ms);
  let el = (Lm - Ls) % 360;
  if (el < 0) el += 360;
  return el;
}

export interface MoonInfo {
  age: number;
  emoji: string;
  holy: string | null; // つきたち / かたみに / くまなし / ありあけ
  reki: string; // 旧暦◯日
}

/** 日付キー（JST正午）の月齢・月相・聖点・旧暦日 */
export function moonOf(dateKey: string): MoonInfo {
  const [y, m, d] = dateKey.split("-").map(Number);
  const el = elongationAt(Date.UTC(y, m - 1, d, 3, 0, 0)); // JST 12:00
  const age = (el / 360) * SYNODIC;
  const emoji =
    age < 1.85 ? "🌑" : age < 5.5 ? "🌒" : age < 9.2 ? "🌓" : age < 12.9 ? "🌔" :
    age < 16.6 ? "🌕" : age < 20.3 ? "🌖" : age < 24 ? "🌗" : age < 27.7 ? "🌘" : "🌑";
  let holy: string | null = null;
  if (age < 1 || age > SYNODIC - 0.5) holy = "つきたち";
  else if (Math.abs(age - SYNODIC * 0.25) < 0.6) holy = "かたみに";
  else if (Math.abs(age - SYNODIC * 0.5) < 0.6) holy = "くまなし";
  else if (Math.abs(age - SYNODIC * 0.75) < 0.6) holy = "ありあけ";
  const rd = Math.floor(age) + 1;
  return { age, emoji, holy, reki: (KANJI[rd] ?? String(rd)) + "日" };
}

export interface MoonEvent {
  type: "new" | "full";
  time: number; // ms UTC
}

/** これからの新月・満月（二分法で分単位） */
export function nextMoons(count: number, fromMs = Date.now()): MoonEvent[] {
  const res: MoonEvent[] = [];
  const step = 3600000;
  let prev = elongationAt(fromMs);
  for (let i = 1; i < 24 * 70 && res.length < count; i++) {
    const t = fromMs + i * step;
    const e = elongationAt(t);
    const bisect = (target: number): number => {
      let a = t - step, b = t;
      for (let j = 0; j < 24; j++) {
        const mid = (a + b) / 2;
        const d = ((elongationAt(mid) - target + 540) % 360) - 180;
        if (d < 0) a = mid;
        else b = mid;
      }
      return (a + b) / 2;
    };
    if (prev > 340 && e < 20) res.push({ type: "new", time: bisect(360) });
    if (prev < 180 && e >= 180) res.push({ type: "full", time: bisect(180) });
    prev = e;
  }
  return res.sort((a, b) => a.time - b.time).slice(0, count);
}

/**
 * 太陽の視黄経（Meeus 高精度短式・誤差 ~0.0006° ≈ 時刻で約1分）。
 * 静的な361点テーブルに依存しないので、どの年でも節分かれつ刻を計算できる。
 */
export function sunLongitudeAt(msUtc: number): number {
  const jd = msUtc / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) * Math.PI) / 180;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.000289 * Math.sin(3 * M);
  const O = ((125.04 - 1934.136 * T) * Math.PI) / 180;
  let lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(O)) % 360;
  if (lam < 0) lam += 360;
  return lam;
}

function jstDateKey(ms: number): string {
  return new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
}
function jstTime(ms: number): string {
  return new Date(ms + 9 * 3600000).toISOString().slice(11, 16);
}

/** [t0,t1] の間に太陽黄経が整数度を横切る時刻を全て求める（二分法・分単位） */
export function computeNodes(t0: number, t1: number): Array<{ deg: number; ms: number }> {
  const res: Array<{ deg: number; ms: number }> = [];
  const step = 6 * 3600000;
  let prev = sunLongitudeAt(t0);
  for (let t = t0 + step; t <= t1 + step; t += step) {
    const cur = sunLongitudeAt(t);
    let d0 = Math.floor(prev);
    let d1 = Math.floor(cur);
    if (cur < prev) d1 += 360; // 359→0 の折り返し
    for (let d = d0 + 1; d <= d1; d++) {
      const target = ((d % 360) + 360) % 360;
      let a = t - step;
      let b = t;
      for (let i = 0; i < 24; i++) {
        const m = (a + b) / 2;
        const diff = ((sunLongitudeAt(m) - target + 540) % 360) - 180;
        if (diff < 0) a = m;
        else b = m;
      }
      res.push({ deg: target, ms: (a + b) / 2 });
    }
    prev = cur;
  }
  return res;
}

function levelOfDeg(deg: number): 1 | 2 | 3 | 4 {
  if (SHISHI.has(deg)) return 4;
  if (SEKKI[deg]) return 3;
  if (KOU[deg]) return 2;
  return 1;
}

/** 月単位の節分かれつ刻マップ（天文計算・キャッシュつき） */
const monthCache = new Map<string, Record<string, NodeEvent[]>>();
export function monthNodeEvents(year: number, month0: number): Record<string, NodeEvent[]> {
  const key = `${year}-${month0}`;
  const hit = monthCache.get(key);
  if (hit) return hit;
  // 対象月の前後1日ぶん余裕を持って計算（JST基準）
  const t0 = Date.UTC(year, month0, 1) - 9 * 3600000 - 86400000;
  const t1 = Date.UTC(year, month0 + 1, 1) - 9 * 3600000 + 86400000;
  const map: Record<string, NodeEvent[]> = {};
  for (const { deg, ms } of computeNodes(t0, t1)) {
    const k = jstDateKey(ms);
    (map[k] ??= []).push({
      deg,
      time: jstTime(ms),
      level: levelOfDeg(deg),
      sekki: SEKKI[deg],
      kou: KOU[deg],
    });
  }
  monthCache.set(key, map);
  return map;
}

/** 日付キーの節分かれつ刻イベント（天文計算版） */
export function eventsOfComputed(dateKey: string): NodeEvent[] {
  const [y, m] = dateKey.split("-").map(Number);
  return monthNodeEvents(y, m - 1)[dateKey] ?? [];
}

export function bestOfComputed(dateKey: string): NodeEvent | null {
  const events = eventsOfComputed(dateKey);
  if (!events.length) return null;
  return events.reduce((a, b) => (b.level > a.level ? b : a));
}

export const YOBI = ["日", "月", "火", "水", "木", "金", "土"];

/** 端末ローカル（JST想定）の "YYYY-MM-DD" */
export function todayKey(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function keyOf(y: number, m1: number, d: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${y}-${p(m1)}-${p(d)}`;
}
