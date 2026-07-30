import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** 貼られた URL の OGP（タイトル・説明・画像）を取得する（楽市楽座から移植） */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OneseaBot/1.0)",
      },
    });

    const html = await response.text();

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

    return NextResponse.json({
      url,
      title: title.trim(),
      description: description.trim(),
      image: image.trim(),
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch OGP data" }, { status: 500 });
  }
}
