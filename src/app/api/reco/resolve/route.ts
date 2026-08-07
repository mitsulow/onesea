import { NextRequest, NextResponse } from "next/server";

/**
 * Googleマップの共有リンク(maps.app.goo.gl等)を貼るだけで店カードを作るための解決API。
 * 課金APIは使わない: 共有リンクを辿った先のURL自体に「店名・緯度経度」が入っているので、
 * リダイレクト先URLを文字列として解析するだけ（Google Maps APIは呼ばない＝無料）。
 */
const ALLOWED_HOSTS = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "www.google.co.jp",
  "google.co.jp",
];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.includes(u.hostname)) {
    return NextResponse.json({ error: "not_gmap" }, { status: 400 });
  }
  try {
    // 短縮リンクを実URLへ（本文は読まない。URLだけ欲しい）
    const res = await fetch(u.toString(), {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (OneSea reco resolver)" },
    });
    const finalUrl = decodeURIComponent(res.url);

    // 店名: /maps/place/<name>/ の部分
    let name: string | null = null;
    const mName = finalUrl.match(/\/maps\/place\/([^/@]+)/);
    if (mName) name = mName[1].replace(/\+/g, " ").trim();

    // 座標: !3d<lat>!4d<lng> (店ピン) を最優先、なければ @lat,lng (画面中心)
    let lat: number | null = null,
      lng: number | null = null;
    const mPin = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const mAt = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (mPin) {
      lat = parseFloat(mPin[1]);
      lng = parseFloat(mPin[2]);
    } else if (mAt) {
      lat = parseFloat(mAt[1]);
      lng = parseFloat(mAt[2]);
    }

    if (!name && lat == null) {
      return NextResponse.json({ error: "parse_failed" }, { status: 422 });
    }
    return NextResponse.json({ name, lat, lng });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
