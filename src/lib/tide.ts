"use client";

/**
 * 潮汐（気象庁 239港）— ツキヨガの GitHub データを共通ソースとして利用。
 * 現在位置から一番近い港を選び、その港の年間データを端末にキャッシュする。
 * データ: https://mitsulow.github.io/0Lei/data/tide/{year}/{code}.json
 */

const BASE = "https://mitsulow.github.io/0Lei/data/tide";

interface Port {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

export interface TideDay {
  port: string;
  high: Array<[string, number]>; // [時刻, cm]
  low: Array<[string, number]>;
}

let portsCache: Port[] | null = null;
const yearCache = new Map<string, Record<string, { high: Array<[string, number]>; low: Array<[string, number]> }>>();

async function loadPorts(): Promise<Port[]> {
  if (portsCache) return portsCache;
  const res = await fetch(`${BASE}/ports.json`);
  const data = await res.json();
  const list: Port[] = Array.isArray(data) ? data : (data.ports ?? []);
  portsCache = list;
  return list;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 現在位置（localStorage キャッシュつき。オンボーディングで許可済みの想定） */
async function getPosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    const cached = localStorage.getItem("onesea-pos");
    if (cached) {
      const p = JSON.parse(cached);
      if (Date.now() - p.at < 24 * 3600000) return { lat: p.lat, lon: p.lon };
    }
  } catch {}
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, at: Date.now() };
        try {
          localStorage.setItem("onesea-pos", JSON.stringify(p));
        } catch {}
        resolve({ lat: p.lat, lon: p.lon });
      },
      () => resolve(null),
      { timeout: 5000, maximumAge: 3600000 }
    );
  });
}

async function loadYear(code: string, year: number) {
  const key = `${code}-${year}`;
  const hit = yearCache.get(key);
  if (hit) return hit;
  // localStorage キャッシュ（1港ぶんだけ保持）
  try {
    const ls = localStorage.getItem("onesea-tide");
    if (ls) {
      const obj = JSON.parse(ls);
      if (obj.key === key) {
        yearCache.set(key, obj.days);
        return obj.days;
      }
    }
  } catch {}
  const res = await fetch(`${BASE}/${year}/${code}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  yearCache.set(key, data.days);
  try {
    localStorage.setItem("onesea-tide", JSON.stringify({ key, days: data.days }));
  } catch {}
  return data.days;
}

/** 日付キー（YYYY-MM-DD）の最寄り港の満潮・干潮 */
export async function fetchTideDay(dateKey: string): Promise<TideDay | null> {
  try {
    const pos = await getPosition();
    const ports = await loadPorts();
    if (!ports.length) return null;
    let port = ports[0];
    if (pos) {
      let best = Infinity;
      for (const p of ports) {
        const d = haversine(pos.lat, pos.lon, p.lat, p.lon);
        if (d < best) {
          best = d;
          port = p;
        }
      }
    } else {
      // 位置不明時は那覇（N9?）が分からないので東京近辺を探す
      port = ports.find((p) => p.name.includes("東京")) ?? ports[0];
    }
    const year = Number(dateKey.slice(0, 4));
    const days = await loadYear(port.code, year);
    if (!days) return null;
    const day = days[dateKey];
    if (!day) return null;
    return { port: port.name, high: day.high ?? [], low: day.low ?? [] };
  } catch {
    return null;
  }
}
