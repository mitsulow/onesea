import { NextResponse } from "next/server";

/**
 * NASA SDO(AIA 304Å)の静止画アーカイブから「直近48時間のコマ」を返す。
 * 公式の latest mp4 は63MBでmoovが末尾にあり、ブラウザ再生が実質不可能だったため、
 * 15分毎の512px JPGを1時間おきに間引いてフリップブック(パラパラ動画)にする。
 * 一覧ページ(Apacheのインデックス)はCORSで読めないのでここでプロキシする。
 */
const BASE = "https://sdo.gsfc.nasa.gov/assets/img/browse";

async function listDay(d: Date): Promise<string[]> {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const dir = `${BASE}/${y}/${m}/${day}/`;
  try {
    const r = await fetch(dir, { headers: { "user-agent": "OneSea/1.0" }, next: { revalidate: 900 } });
    const html = await r.text();
    const names = [...new Set(html.match(/\d{8}_\d{6}_512_0304\.jpg/g) ?? [])].sort();
    return names.map((n) => dir + n);
  } catch {
    return [];
  }
}

export async function GET() {
  const now = new Date();
  const days: Date[] = [new Date(now.getTime() - 2 * 86400000), new Date(now.getTime() - 86400000), now];
  const all = (await Promise.all(days.map(listDay))).flat();
  // 直近48時間ぶんを、全体で48コマ程度になるよう等間隔に間引く
  const cutoff = now.getTime() - 48 * 3600000;
  const recent = all.filter((u) => {
    const m = u.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_512/);
    if (!m) return false;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) >= cutoff;
  });
  const N = 48;
  const step = Math.max(1, Math.floor(recent.length / N));
  const frames = recent.filter((_, i) => i % step === 0).slice(-N);
  return NextResponse.json(
    { frames },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800" } }
  );
}
