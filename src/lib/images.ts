"use client";

import { createClient } from "@/lib/supabase/client";

/** クライアント側で圧縮（パケ死しない画像配信の第一歩） */
export function compressImage(file: File, maxEdge: number, quality: number): Promise<Blob> {
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
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
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
