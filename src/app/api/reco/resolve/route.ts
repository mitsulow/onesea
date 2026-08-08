import { NextRequest, NextResponse } from "next/server";

/**
 * Google共有リンク（マップ・検索どちらでも）を貼るだけで店カードを作る解決API。
 * 課金APIは使わない。手順を重ねて確実に拾う:
 *  ① 短縮リンク(maps.app.goo.gl / share.google / g.co / goo.gl)のページ自体のHTMLから
 *     og:title / og:image / 座標パターンを読む
 *  ② リダイレクト先の最終URLから /maps/place/<店名> と !3d!4d / @lat,lng を読む
 *  ③ 検索共有(google.com/search?q=◯◯)は q= を店名として使う
 *  ④ 座標が取れなければ OSM Nominatim（無料）で店名から緯度経度を取る
 *  ⑤ 画像は og:image か、HTML中の googleusercontent 写真の1枚目
 */
const HOST_OK = /(^|\.)((maps\.app\.)?goo\.gl|share\.google|g\.co|google\.(com|co\.jp)|maps\.google\.com)$/;

const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" };

function pickMeta(html: string, prop: string): string | null {
  const re1 = new RegExp(`property="${prop}"[^>]*content="([^"]+)"`);
  const re2 = new RegExp(`content="([^"]+)"[^>]*property="${prop}"`);
  const m = html.match(re1) ?? html.match(re2);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

function pickCoords(text: string): { lat: number; lng: number } | null {
  const pin = text.match(/!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (pin) return { lat: parseFloat(pin[1]), lng: parseFloat(pin[2]) };
  const at = text.match(/@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = text.match(/[?&](?:q|query|center)=(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  return null;
}

function cleanName(t: string | null): string | null {
  if (!t) return null;
  const n = t
    .replace(/\s*[-–·|]\s*Google\s*(マップ|Maps|検索|Search).*$/i, "")
    .replace(/\s*·.*$/, "")
    .trim();
  return n && n.toLowerCase() !== "google maps" && n !== "Google マップ" ? n : null;
}

function pickImage(html: string, allowStatic = false): string | null {
  const og = pickMeta(html, "og:image");
  // Googleの既定サムネ(staticmap)より実写真を優先
  const photo = html.match(/https:\/\/lh\d\.googleusercontent\.com\/(?:p\/|gps-cs|places\/)[^"'\\\s)]+/);
  if (photo) return photo[0].replace(/=w\d+.*$/, "=w640-h480-k-no");
  const anyPhoto = html.match(/https:\/\/lh\d\.googleusercontent\.com\/[^"'\\\s)]{20,}/);
  if (anyPhoto) return anyPhoto[0].replace(/=w\d+.*$/, "=w640-h480-k-no");
  if (og && !og.includes("staticmap")) return og;
  if (og && allowStatic) return og; // 最後の手段: 地図サムネでも無いよりマシ
  return null;
}

async function nominatim(name: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const r = await fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=jp&q=" + encodeURIComponent(name),
      { headers: { "user-agent": "OneSea/1.0 (reco resolver)" } }
    );
    const j = await r.json();
    if (Array.isArray(j) && j[0]) return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), label: j[0].display_name };
  } catch {}
  return null;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const hint = (req.nextUrl.searchParams.get("hint") ?? "").slice(0, 120).trim() || null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  if (!HOST_OK.test(u.hostname)) {
    return NextResponse.json({ error: "not_google" }, { status: 400 });
  }

  let name: string | null = null;
  let coords: { lat: number; lng: number } | null = null;
  let image: string | null = null;

  try {
    // リダイレクトを追いつつ、最終ページのHTMLも読む
    const res = await fetch(u.toString(), { redirect: "follow", headers: UA });
    let finalUrl = "";
    try {
      finalUrl = decodeURIComponent(res.url);
    } catch {
      finalUrl = res.url;
    }
    const html = await res.text().catch(() => "");

    // 店名: /maps/place/<name> → 検索共有の q= → og:title → <title>
    const mPlace = finalUrl.match(/\/maps\/place\/([^/@?]+)/);
    if (mPlace) name = decodeURIComponent(mPlace[1].replace(/\+/g, " ")).trim();
    if (!name) {
      try {
        const fu = new URL(res.url);
        const q = fu.searchParams.get("q");
        if (q && !/^-?\d+\.\d+,/.test(q)) name = q.trim();
      } catch {}
    }
    if (!name) name = cleanName(pickMeta(html, "og:title"));
    if (!name) {
      const t = html.match(/<title>([^<]+)<\/title>/);
      name = cleanName(t ? t[1] : null);
    }
    if (!name && hint) name = hint;

    // 座標: 最終URL → HTML本文
    coords = pickCoords(finalUrl) ?? pickCoords(html);

    // 画像
    image = pickImage(html, true);

    // 座標がまだ無ければ店名からジオコーディング（無料）
    if (!coords && name) {
      const g = await nominatim(name + (hint && hint !== name ? " " + hint : ""));
      if (!g && name.includes(" ")) {
        const g2 = await nominatim(name.split(" ")[0]);
        if (g2) coords = { lat: g2.lat, lng: g2.lng };
      } else if (g) {
        coords = { lat: g.lat, lng: g.lng };
      }
    }

    if (!name && !coords) {
      return NextResponse.json({ error: "parse_failed" }, { status: 422 });
    }
    return NextResponse.json({ name, lat: coords?.lat ?? null, lng: coords?.lng ?? null, image });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
