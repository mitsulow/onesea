"use client";

import { createClient } from "@/lib/supabase/client";
import type { CotozuteProfile } from "./cotozute";

export type Market = "ichi" | "za";

export interface Shop {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  price_jpy: number | null;
  pay_url?: string | null; // BASE・PayPay等の外部購入リンク
  barter_slots?: number | null; // 何人まで物々交換できるか(null=1人)
  first_try?: boolean | null; // 🔰これが初挑戦(楽市の初心者応援)
  sold?: boolean; // ブツブツ交換成立などで売り切れ
  handover?: string | null; // 交換方法: pickup(取りに来て) / cod(着払い郵送) / both
  is_trial: boolean;
  accepts_barter: boolean;
  accepts_tip: boolean;
  category: string | null;
  market: Market;
  image_urls: string[];
  thumb_urls: string[] | null;
  created_at: string;
  profiles: (CotozuteProfile & { username: string | null }) | null;
  shop_comments?: Array<{ count: number }>;
}

export interface ShopComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: (CotozuteProfile & { username: string | null }) | null;
}

export const ZA_CATEGORIES = [
  { id: "food", label: "たべもの", emoji: "🌾" },
  { id: "living", label: "暮らし", emoji: "🏡" },
  { id: "healing", label: "癒し", emoji: "💆" },
  { id: "learning", label: "学び", emoji: "📚" },
  { id: "experience", label: "体験", emoji: "🛶" },
  { id: "other", label: "その他", emoji: "✨" },
] as const;

export function categoryOf(id: string | null) {
  return ZA_CATEGORIES.find((c) => c.id === id) ?? null;
}

const SHOP_SELECT =
  "id, owner_id, name, description, price_jpy, pay_url, is_trial, first_try, accepts_barter, accepts_tip, barter_slots, category, market, sold, handover, image_urls, thumb_urls, created_at, profiles!shops_owner_id_fkey(username, display_name, avatar_url), shop_comments(count)";

export async function fetchShops(category?: string | null): Promise<Shop[]> {
  const supabase = createClient();
  let q = supabase.from("shops").select(SHOP_SELECT).order("created_at", { ascending: false }).limit(60);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return (data as unknown as Shop[]) ?? [];
}

export async function fetchShopsByOwner(ownerId: string): Promise<Shop[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shops")
    .select(SHOP_SELECT)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  return (data as unknown as Shop[]) ?? [];
}

export async function fetchShop(id: string): Promise<Shop | null> {
  const supabase = createClient();
  const { data } = await supabase.from("shops").select(SHOP_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as Shop) ?? null;
}

export async function deleteShop(id: string, ownerId: string) {
  const supabase = createClient();
  return supabase.from("shops").delete().eq("id", id).eq("owner_id", ownerId);
}

/* ---- 商品コメント（ツッコミ歓迎） ---- */
export async function fetchShopComments(shopId: string): Promise<ShopComment[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shop_comments")
    .select("id, user_id, body, created_at, profiles!shop_comments_user_id_fkey(username, display_name, avatar_url)")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true })
    .limit(100);
  return (data as unknown as ShopComment[]) ?? [];
}

export async function addShopComment(shopId: string, userId: string, body: string) {
  const supabase = createClient();
  return supabase.from("shop_comments").insert({ shop_id: shopId, user_id: userId, body });
}

export async function deleteShopComment(id: string, userId: string) {
  const supabase = createClient();
  return supabase.from("shop_comments").delete().eq("id", id).eq("user_id", userId);
}

/** 商品写真の2枚方式: 一覧サムネ400px + 詳細用1280px（R2へ・パケ死対策） */
export async function uploadShopImage(
  userId: string,
  file: File
): Promise<{ full: string; thumb: string } | null> {
  const [fullBlob, thumbBlob] = await Promise.all([
    compressImage(file, 1280, 0.75).catch(() => null),
    compressImage(file, 400, 0.6).catch(() => null),
  ]);
  if (!fullBlob || !thumbBlob) return null;
  const [full, thumb] = await Promise.all([
    r2OrStorageUpload("shop-images", userId, fullBlob),
    r2OrStorageUpload("shop-images", userId, thumbBlob),
  ]);
  if (!full || !thumb) return null;
  return { full, thumb };
}

/** R2優先アップロード（失敗時Supabase）。images.ts の uploadCroppedBlob と同経路 */
async function r2OrStorageUpload(bucket: string, userId: string, blob: Blob): Promise<string | null> {
  try {
    const fd = new FormData();
    fd.append("file", blob, "image.webp");
    fd.append("folder", bucket);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (r.ok) {
      const { url } = await r.json();
      if (url) return url;
    }
  } catch {
    /* フォールバックへ */
  }
  const supabase = createClient();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function compressImage(file: File, maxEdge: number, quality: number): Promise<Blob> {
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
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("toBlob"))),
        "image/webp",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load"));
    };
    img.src = url;
  });
}

/* ============ わたしのおススメ（外部リンク紹介）============ */

export interface Reco {
  id: string;
  user_id: string;
  title: string;
  url: string | null;
  comment: string | null;
  created_at: string;
}

export async function fetchRecos(userId: string): Promise<Reco[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("recommendations")
    .select("id, user_id, title, url, comment, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as Reco[]) ?? [];
}

export async function addReco(userId: string, title: string, url: string, comment: string) {
  const supabase = createClient();
  return supabase.from("recommendations").insert({
    user_id: userId,
    title: title.trim(),
    url: url.trim() || null,
    comment: comment.trim() || null,
  });
}

export async function deleteReco(id: string, userId: string) {
  const supabase = createClient();
  return supabase.from("recommendations").delete().eq("id", id).eq("user_id", userId);
}
