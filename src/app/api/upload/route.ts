import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { r2Put, r2Ready } from "@/lib/r2";

/**
 * 画像アップロードの受け口。クライアントで圧縮済みのWebPを受け取り、
 * R2（転送料ゼロのCDN倉庫）に保存して公開URLを返す。
 * ログイン必須。1枚あたり最大3MB（圧縮済みならこれで足りる）。
 */
export const runtime = "nodejs";
const MAX = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (!r2Ready()) return NextResponse.json({ error: "r2 not configured" }, { status: 503 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "post-images");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!/^[a-z0-9-]+$/.test(folder)) return NextResponse.json({ error: "bad folder" }, { status: 400 });

  const type = file.type || "image/webp";
  const ext = type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : "webp";
  // ユーザーIDで名前空間を切り、衝突しないキーに（時刻+乱数はクライアント任せにせずここで）
  const rand = crypto.randomUUID().slice(0, 8);
  const key = `${folder}/${user.id}/${Date.now()}-${rand}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const url = await r2Put(key, bytes, type);
  if (!url) return NextResponse.json({ error: "upload failed" }, { status: 502 });
  return NextResponse.json({ url });
}
