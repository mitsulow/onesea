import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** 内部・私設ネットワーク宛かどうか（SSRF対策）。ホスト名/IPで弾く */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") || h.endsWith(".local")) return true;
  // IPv6ローカル
  if (h === "::1" || h.startsWith("[::1]") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  // IPv4私設・ループバック・リンクローカル(169.254 = クラウドメタデータ)
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // メタデータサーバ
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

/** 貼られた URL の OGP（タイトル・説明・画像）を取得する（楽市楽座から移植） */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // http(s) の外部ホストのみ許可（内部サービス・クラウドメタデータへのSSRFを遮断）
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) {
    return NextResponse.json({ error: "blocked" }, { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OneseaBot/1.0)",
      },
      redirect: "manual", // リダイレクトで内部宛に飛ばされるのを防ぐ
      signal: AbortSignal.timeout(6000),
    });

    // 最大512KBだけ読む（巨大レスポンスでのメモリ枯渇を防ぐ）
    const html = (await response.text()).slice(0, 512 * 1024);

    const getMetaContent = (property: string): string | null => {
      const regex = new RegExp(
        `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
        "i"
      );
      const match = html.match(regex);
      if (match) return match[1];
      const regex2 = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        "i"
      );
      const match2 = html.match(regex2);
      return match2 ? match2[1] : null;
    };

    const title =
      getMetaContent("og:title") ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
      "";
    const description =
      getMetaContent("og:description") || getMetaContent("description") || "";
    const image = getMetaContent("og:image") || "";

    return NextResponse.json(
      {
        url,
        title: title.trim(),
        description: description.trim(),
        image: image.trim(),
      },
      // 同じURLの貼り付けは1日エッジキャッシュ（都度オリジン取得を避ける）
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
    );
  } catch {
    return NextResponse.json({ error: "Failed to fetch OGP data" }, { status: 500 });
  }
}
