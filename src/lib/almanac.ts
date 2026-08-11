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
  // 聖点: その日（JST 0時〜24時）の間に朔・上弦・望・下弦の「瞬間」を含む日だけ。
  // 月齢の幅で判定すると2日連続になるため、黄経差の通過で判定（ツキヨガ方式）
  const el0 = elongationAt(Date.UTC(y, m - 1, d - 1, 15, 0, 0)); // JST 0:00
  let el1 = elongationAt(Date.UTC(y, m - 1, d, 15, 0, 0)); // JST 24:00
  if (el1 < el0) el1 += 360;
  let holy: string | null = null;
  for (const [target, name] of [
    [90, "かたみに"],
    [180, "くまなし"],
    [270, "ありあけ"],
    [360, "つきたち"],
  ] as const) {
    if (el0 < target && target <= el1) holy = name;
  }
  // 旧暦日は月齢の切り捨てではなく、朔の日を1日とする天文計算(kyurekiOf)に統一
  const rd = Math.min(30, Math.max(1, kyurekiOf(dateKey).day));
  return { age, emoji, holy, reki: (KANJI[rd] ?? String(rd)) + "日" };
}

export interface MoonEvent {
  type: "new" | "full";
  time: number; // ms UTC
}

/** ある年の新月・満月をすべて計算（過去の会のアーカイブ用） */
export function moonsOfYear(year: number): MoonEvent[] {
  const res: MoonEvent[] = [];
  let cursor = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  while (cursor < end) {
    const batch = nextMoons(6, cursor);
    if (batch.length === 0) break;
    for (const m of batch) {
      if (m.time < end) res.push(m);
    }
    if (batch[batch.length - 1].time >= end) break;
    cursor = batch[batch.length - 1].time + 3600000;
  }
  return res.filter((m) => m.time >= new Date(year, 0, 1).getTime() && m.time < end);
}

/** これからの新月・満月（二分法で分単位） */
export function nextMoons(count: number, fromMs = Date.now()): MoonEvent[] {
  const res: MoonEvent[] = [];
  const step = 3600000;
  let prev = elongationAt(fromMs);
  for (let i = 1; i < 24 * 240 && res.length < count; i++) { // 約8ヶ月先まで探索（月例会10件分）
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

/* ---- 月の位置（低精度Meeus・誤差数分）と月の出・南中・月の入り ---- */
const D2R = Math.PI / 180;

function moonEqOf(msUtc: number): { ra: number; dec: number } {
  const d = msUtc / 86400000 - 10957.5; // J2000からの日数
  const L = (218.316 + 13.176396 * d) * D2R;
  const M = (134.963 + 13.064993 * d) * D2R;
  const F = (93.272 + 13.22935 * d) * D2R;
  const lon = L + 6.289 * D2R * Math.sin(M);
  const lat = 5.128 * D2R * Math.sin(F);
  const e = 23.4397 * D2R;
  const ra = Math.atan2(Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e), Math.cos(lon));
  const dec = Math.asin(Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon));
  return { ra, dec };
}

function moonAltAt(msUtc: number, latDeg: number, lonDeg: number): number {
  const d = msUtc / 86400000 - 10957.5;
  const { ra, dec } = moonEqOf(msUtc);
  const gmst = (280.16 + 360.9856235 * d) * D2R;
  const H = gmst + lonDeg * D2R - ra;
  const la = latDeg * D2R;
  return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
}

export interface MoonTimes {
  rise: string | null;
  transit: string | null;
  set: string | null;
}

/** その日（JST）の月の出・南中・月の入り。位置は緯度経度（既定は東京） */
export function moonTimesOf(dateKey: string, latDeg = 35.68, lonDeg = 139.76): MoonTimes {
  const [y, m, dd] = dateKey.split("-").map(Number);
  const start = Date.UTC(y, m - 1, dd) - 9 * 3600000; // JST 0:00
  const h0 = 0.125 * D2R; // 出没の基準高度（視差-屈折の相殺で約+0.125°）
  const step = 5 * 60000;
  let rise: number | null = null;
  let set: number | null = null;
  let maxAlt = -10;
  let maxT = start;
  let prev = moonAltAt(start, latDeg, lonDeg) - h0;
  for (let t = start + step; t <= start + 24 * 3600000; t += step) {
    const alt = moonAltAt(t, latDeg, lonDeg) - h0;
    if (prev < 0 && alt >= 0 && rise === null) rise = t - step / 2;
    if (prev >= 0 && alt < 0 && set === null) set = t - step / 2;
    if (alt > maxAlt) {
      maxAlt = alt;
      maxT = t;
    }
    prev = alt;
  }
  const fmt = (t: number | null) =>
    t === null ? null : new Date(t + 9 * 3600000).toISOString().slice(11, 16);
  return { rise: fmt(rise), transit: maxAlt > 0 ? fmt(maxT) : null, set: fmt(set) };
}

/** 月齢→NASA月画像（/icons/moon/moon_01〜30.png・約3KB） */
export function moonImageOf(age: number): string {
  const idx = Math.min(29, Math.max(0, Math.round(age)));
  return `/icons/moon/moon_${String(idx + 1).padStart(2, "0")}.png`;
}

/* ---- 旧暦（朔望月 + 中気で月名を決める本式・閏月対応） ---- */
const CHUKI_MONTH: Record<number, number> = {
  330: 1, 0: 2, 30: 3, 60: 4, 90: 5, 120: 6,
  150: 7, 180: 8, 210: 9, 240: 10, 270: 11, 300: 12,
};

export function kyurekiOf(dateKey: string): { month: number; leap: boolean; day: number } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const noon = Date.UTC(y, m - 1, d, 3); // JST正午
  // この日を含む朔望月（朔=新月の瞬間）を探す
  const news = nextMoons(5, noon - 40 * 86400000).filter((x) => x.type === "new");
  // 旧暦日 = 朔のあった日（JST）を1日目とする。
  // 比較は「瞬間」ではなく「JSTの日付」で行う — 朔が正午より後に起きる日(例: 2026-09-11 13:14)でも
  // その日がちゃんと1日になる(以前は瞬間比較だったため1日が消えて晦日→2日と飛んでいた)
  const dayIdx = (ms: number) => Math.floor((ms + 9 * 3600000) / 86400000);
  let start: number | null = null;
  let next: number | null = null;
  for (const n of news) {
    if (dayIdx(n.time) <= dayIdx(noon)) start = n.time;
    else if (start !== null && next === null) next = n.time;
  }
  // moonOf は reki で kyurekiOf を呼ぶため、ここでは直接月齢を計算して循環を断つ
  const fallbackDay = Math.floor((elongationAt(noon) / 360) * SYNODIC) + 1;
  if (start === null) return { month: 0, leap: false, day: fallbackDay };
  if (next === null) {
    const more = nextMoons(3, start + 86400000).filter((x) => x.type === "new");
    next = more[0]?.time ?? start + 30 * 86400000;
  }
  const day = dayIdx(noon) - dayIdx(start) + 1;
  // 月名: この朔望月に含まれる中気（太陽黄経30°の倍数）で決まる
  const t0 = dayIdx(start) * 86400000 - 9 * 3600000;
  const t1 = dayIdx(next) * 86400000 - 9 * 3600000;
  const chuki = computeNodes(t0, t1 - 1).filter((n) => n.deg % 30 === 0);
  if (chuki.length > 0) return { month: CHUKI_MONTH[chuki[0].deg], leap: false, day };
  // 中気を含まない月 = 閏月（前月の名前を引き継ぐ）
  const prev = computeNodes(t0 - 33 * 86400000, t0 - 1).filter((n) => n.deg % 30 === 0);
  const pm = prev.length ? CHUKI_MONTH[prev[prev.length - 1].deg] : 0;
  return { month: pm, leap: true, day };
}

/** 和風月名（旧暦の月） */
const WAFU_MONTHS = ["", "睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"];
const KANJI_DAYS = ["", "一日", "二日", "三日", "四日", "五日", "六日", "七日", "八日", "九日", "十日",
  "十一日", "十二日", "十三日", "十四日", "十五日", "十六日", "十七日", "十八日", "十九日", "二十日",
  "二十一日", "二十二日", "二十三日", "二十四日", "二十五日", "二十六日", "二十七日", "二十八日", "二十九日", "三十日"];

/** 「旧暦文月八日（旧7月8日）」形式 */
export function kyurekiFullLabel(dateKey: string): string {
  const k = kyurekiOf(dateKey);
  if (!k.month) return `旧暦：${k.day}日`;
  const wafu = WAFU_MONTHS[k.month] ?? `${k.month}月`;
  const kd = KANJI_DAYS[Math.min(30, Math.max(1, k.day))];
  return `旧暦：${k.leap ? "閏" : ""}${wafu}${kd}（旧${k.month}月${k.day}日）`;
}

/** ツキヨガの30日「月の呼び名」辞書（旧暦の日 → 呼び名） */
const MOON_NAMES_30: Record<number, [string, string]> = {
  1: ["つきたち", "月立ち"], 2: ["ふつかづき", "二日月"], 3: ["みかづき", "三日月"], 4: ["まゆづき", "眉月"],
  5: ["ゆうづき", "夕月"], 6: ["むいかづき", "六日月"], 7: ["かたみに", "互に"], 8: ["よいづき", "宵月"],
  9: ["ここのかづき", "九日月"], 10: ["とおかんや", "十日夜"], 11: ["じゅういちや", "十一夜"], 12: ["じゅうにや", "十二夜"],
  13: ["あたらよ", "可惜夜"], 14: ["まちよい", "待宵"], 15: ["くまなし", "隈無し"], 16: ["いざよい", "十六夜"],
  17: ["たちまち", "立待月"], 18: ["いまち", "居待月"], 19: ["ねまち", "寝待月"], 20: ["ふけまち", "更待月"],
  21: ["にじゅういちや", "二十一夜"], 22: ["にじゅうにや", "二十二夜"], 23: ["ありあけ", "有明"], 24: ["にじゅうよや", "二十四夜"],
  25: ["ほしあひ", "星合"], 26: ["なごりづき", "名残月"], 27: ["あかつき", "暁"], 28: ["あけぼの", "曙"],
  29: ["つごもり", "晦・月籠"], 30: ["みそか", "晦日"],
};

/** その日の月の呼び名（ひらがな・漢字）— 旧暦日(天文計算)から引く */
export function moonNameOf(dateKey: string): { yomi: string; kanji: string } {
  // 以前は平均朔望月の簡易式だったが、月の変わり目で天文計算と1日ズレた
  // (例: 旧暦1日の日に「みそか」と出る)。旧暦日と同じ天文計算に統一。
  const lunarDay = kyurekiOf(dateKey).day;
  const [yomi, kanji] = MOON_NAMES_30[Math.min(30, Math.max(1, lunarDay))] ?? MOON_NAMES_30[1];
  return { yomi, kanji };
}

export function kyurekiLabel(dateKey: string): string {
  const k = kyurekiOf(dateKey);
  if (!k.month) return `旧暦：${k.day}日`;
  return `旧暦：${k.leap ? "閏" : ""}${k.month}月${k.day}日`;
}

/** その日の月の聖点（つきたち・かたみに・くまなし・ありあけ）の瞬間時刻 */
export function holyTimeOf(dateKey: string): { name: string; label: string; time: string } | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t0 = Date.UTC(y, m - 1, d - 1, 15, 0, 0); // JST 0:00
  const t1 = Date.UTC(y, m - 1, d, 15, 0, 0); // JST 24:00
  const el0 = elongationAt(t0);
  let el1 = elongationAt(t1);
  if (el1 < el0) el1 += 360;
  const DEFS: Array<[number, string, string]> = [
    [90, "かたみに", "上弦点"],
    [180, "くまなし", "満月点"],
    [270, "ありあけ", "下弦点"],
    [360, "つきたち", "新月点"],
  ];
  for (const [target, name, label] of DEFS) {
    if (el0 < target && target <= el1) {
      let a = t0;
      let b = t1;
      for (let i = 0; i < 26; i++) {
        const mid = (a + b) / 2;
        const diff = ((elongationAt(mid) - (target % 360) + 540) % 360) - 180;
        if (diff < 0) a = mid;
        else b = mid;
      }
      const tm = new Date((a + b) / 2 + 9 * 3600000);
      return { name, label, time: `${tm.getUTCHours()}時${String(tm.getUTCMinutes()).padStart(2, "0")}分` };
    }
  }
  return null;
}


/* ---- ツキヨガ月占い 12タイプ（本体 tsukiyoga-v7 と全く同じ式） ----
 * 4色(黒紅白蒼) × 3動物(うさぎ/カメ/ワニ)。誕生日の月齢で決まる。
 * マイページにキャラを自動表示するために使う。 */
export const MOON_ORACLE_TYPES = [
  { name: "黒いうさぎ", moon: "シンゲツ", kanji: "新月" },
  { name: "黒いカメ", moon: "ミカヅキ", kanji: "三日月" },
  { name: "黒いワニ", moon: "ユウヅキ", kanji: "夕月" },
  { name: "紅いうさぎ", moon: "カタミニ", kanji: "互に" },
  { name: "紅いカメ", moon: "トオカンヤ", kanji: "十日夜" },
  { name: "紅いワニ", moon: "アタラヨ", kanji: "可惜夜" },
  { name: "白いうさぎ", moon: "マンゲツ", kanji: "満月" },
  { name: "白いカメ", moon: "イザヨイ", kanji: "十六夜" },
  { name: "白いワニ", moon: "ネマチ", kanji: "寝待月" },
  { name: "蒼いうさぎ", moon: "アリアケ", kanji: "有明" },
  { name: "蒼いカメ", moon: "ホシアヒ", kanji: "星合" },
  { name: "蒼いワニ", moon: "アケボノ", kanji: "曙" },
] as const;

/** 誕生日(+時刻JST・未入力は15時) → 12タイプindex。不正な日付は -1 */
export function moonOracleIdxOf(birthday: string, birthTime = "15:00"): number {
  const BASE = Date.parse("2000-01-06T18:14:00Z");
  const SYN = 29.530588853;
  const t = Date.parse(`${birthday}T${birthTime}:00+09:00`);
  if (Number.isNaN(t)) return -1;
  const age = ((((t - BASE) / 86400000) % SYN) + SYN) % SYN;
  return Math.min(11, Math.floor(age / (SYN / 12)));
}
