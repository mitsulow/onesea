import { NextRequest, NextResponse } from "next/server";

/**
 * 画像の回覧板（Supabase Storage のプロキシ）。
 * 投稿画像はファイル名がユニーク（内容が変わらない）ので、
 * エッジとブラウザに1年キャッシュさせる。倉庫（Supabase）からの
 * 持ち出しは世界で数回だけになり、転送課金がほぼ消える。
 * 将来 Cloudflare R2 へ引っ越すときは ORIGIN を1行変えるだけ。
 */
const ORIGIN = "https://hpgofjkxqguzgrptchqj.supabase.co/storage/v1/object/public/";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("p") ?? "";
  // バケット名/パス 形式のみ許可（トラバーサル・外部URL持ち込みを拒否）
  if (!/^[a-z0-9-]+\/[\w\-./%]+$/i.test(p) || p.includes("..")) {
    return new NextResponse("bad path", { status: 400 });
  }
  try {
    const r = await fetch(ORIGIN + p, { cache: "no-store" });
    if (!r.ok) return new NextResponse("upstream " + r.status, { status: r.status === 404 ? 404 : 502 });
    const body = await r.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": r.headers.get("Content-Type") ?? "image/webp",
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
