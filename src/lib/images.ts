"use client";

import { createClient } from "@/lib/supabase/client";

/** iPhoneのHEIC/HEIFをブラウザで扱えるJPEGに変換（必要な時だけライブラリを読み込む） */
async function convertHeic(file: Blob): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

/** クライアント側で圧縮（パケ死しない画像配信の第一歩） */
export async function compressImage(file: File, maxEdge: number, quality: number): Promise<Blob> {
  const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  let src: Blob = file;
  if (isHeic) {
    src = await convertHeic(file);
  }
  try {
    return await rasterize(src, maxEdge, quality);
  } catch (e) {
    // 型がoctet-stream等でHEICと判別できなかった場合の救済: 変換してもう一度
    if (!isHeic) {
      try {
        return await rasterize(await convertHeic(file), maxEdge, quality);
      } catch {}
    }
    throw e;
  }
}

function rasterize(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))), "image/webp", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load"));
    };
    img.src = url;
  });
}

async function uploadBlob(bucket: string, path: string, blob: Blob): Promise<string | null> {
  // まず Cloudflare R2（転送料ゼロのCDN倉庫）へ。folder=bucket名で名前空間を分ける
  try {
    const fd = new FormData();
    fd.append("file", blob, "image.webp");
    fd.append("folder", bucket);
    fd.append("key", path); // 参考情報（サーバー側で最終キーを決める）
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (r.ok) {
      const { url } = await r.json();
      if (url) return url;
    }
  } catch {
    /* R2が未設定・障害時は下のSupabaseへ */
  }
  // フォールバック: Supabase Storage
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    cacheControl: "31536000", // ファイル名ユニークなので1年キャッシュ安全
    contentType: "image/webp",
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** 1枚アップロード（長辺 maxEdge の WebP） */
export async function uploadImage(
  bucket: string,
  userId: string,
  file: File,
  maxEdge = 1600,
  quality = 0.8
): Promise<string | null> {
  const blob = await compressImage(file, maxEdge, quality).catch(() => null);
  if (!blob) return null;
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  return uploadBlob(bucket, path, blob);
}

export interface ImagePair {
  full: string;
  thumb: string;
}

/**
 * 本体（1600px）+ サムネ（400px）の2枚方式。
 * 一覧はサムネだけを並べ、本体はタップされた時だけ配信 — 転送量を1/10以下に。
 */
export async function uploadImagePair(
  bucket: string,
  userId: string,
  file: File
): Promise<ImagePair | null> {
  // パケ死対策と鮮明さの両立: 本体960px/0.6、サムネは640px/0.68
  // （320pxはスマホの実解像度で引き伸ばされて不鮮明→むしろ本体タップを誘発していた）
  const [fullBlob, thumbBlob] = await Promise.all([
    compressImage(file, 960, 0.6).catch(() => null),
    compressImage(file, 640, 0.68).catch(() => null),
  ]);
  if (!fullBlob || !thumbBlob) return null;
  const base = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [full, thumb] = await Promise.all([
    uploadBlob(bucket, `${base}.webp`, fullBlob),
    uploadBlob(bucket, `${base}-thumb.webp`, thumbBlob),
  ]);
  if (!full || !thumb) return null;
  return { full, thumb };
}

/** 切り抜き・加工済みのBlobをそのままアップロード（既に圧縮済みの前提） */
export async function uploadCroppedBlob(bucket: string, userId: string, blob: Blob): Promise<string | null> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  return uploadBlob(bucket, path, blob);
}

/**
 * 表示URLの整流:
 * - R2の公開URL（pub-xxx.r2.dev）→ そのまま（転送料ゼロなので回覧板も不要）
 * - Supabase Storage の公開URL → /api/img 経由（エッジ+1年キャッシュ）
 * - それ以外（Googleアバター等）とnull → そのまま
 */
const STORAGE_PREFIX = "https://hpgofjkxqguzgrptchqj.supabase.co/storage/v1/object/public/";
export function srcCdn(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.includes(".r2.dev/")) return url;
  if (url.startsWith(STORAGE_PREFIX)) return "/api/img?p=" + url.slice(STORAGE_PREFIX.length);
  return url;
}
