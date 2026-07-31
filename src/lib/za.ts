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
  is_trial: boolean;
  accepts_barter: boolean;
  accepts_tip: boolean;
  category: string | null;
  market: Market;
  image_urls: string[];
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
  "id, owner_id, name, description, price_jpy, is_trial, accepts_barter, accepts_tip, category, market, image_urls, created_at, profiles!shops_owner_id_fkey(username, display_name, avatar_url), shop_comments(count)";

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

/** 画像をクライアントで圧縮（長辺1600px・WebP品質0.8）してからアップロード */
export async function uploadShopImage(userId: string, file: File): Promise<string | null> {
  const compressed = await compressImage(file, 1600, 0.8);
  const supabase = createClient();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const { error } = await supabase.storage.from("shop-images").upload(path, compressed, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) return null;
  return supabase.storage.from("shop-images").getPublicUrl(path).data.publicUrl;
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
