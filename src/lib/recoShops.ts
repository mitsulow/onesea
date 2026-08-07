import { createClient } from "@/lib/supabase/client";

/**
 * 「私のおススメの店」— マイページの地図に立てるピン。
 * 全員分を集計してセカイムラの「おススメマップ」にも表示される。
 * 入力は超簡単: 店名を打つ → 候補をタップ → 即ピン（ジオコーディングはOSM Nominatim）。
 */

export interface RecoShop {
  id: string;
  user_id: string;
  name: string;
  category: string;
  comment: string | null;
  lat: number;
  lng: number;
  address: string | null;
  created_at: string;
}

/** カテゴリ4種（セグメント） */
export const RECO_CATS = [
  { id: "alt_med", label: "代替医療", emoji: "🌿", color: "#8a5aa0" },
  { id: "natural_restaurant", label: "ナチュラルなレストラン", emoji: "🍽", color: "#c94d3a" },
  { id: "natural_food", label: "自然食品のお店", emoji: "🌾", color: "#5a7d4a" },
  { id: "massage", label: "整体・マッサージ", emoji: "💆", color: "#3070b0" },
  { id: "other", label: "その他", emoji: "✨", color: "#8a8070" },
] as const;

/** パワースポット（お店とは別セクション。地図では緑のマル） */
export const POWER_CAT = { id: "power_spot", label: "パワースポット", emoji: "⛩", color: "#2a8a4a" } as const;

export const recoCat = (id: string) =>
  id === POWER_CAT.id ? POWER_CAT : (RECO_CATS.find((c) => c.id === id) ?? RECO_CATS[0]);

export async function fetchRecoShops(userId?: string): Promise<RecoShop[]> {
  const supabase = createClient();
  let q = supabase.from("reco_shops").select("*").order("created_at", { ascending: false }).limit(userId ? 100 : 1000);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data as RecoShop[]) ?? [];
}

export async function addRecoShop(
  userId: string,
  shop: { name: string; category: string; lat: number; lng: number; address?: string | null; comment?: string | null }
): Promise<RecoShop | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reco_shops")
    .insert({ user_id: userId, ...shop })
    .select()
    .single();
  return error ? null : (data as RecoShop);
}

export async function deleteRecoShop(id: string, userId: string) {
  const supabase = createClient();
  await supabase.from("reco_shops").delete().eq("id", id).eq("user_id", userId);
}

export interface GeoCandidate {
  label: string;
  lat: number;
  lng: number;
}

/** 店名（+市町村）から候補地点を探す — OSM Nominatim（無料・キー不要） */
export async function geocode(q: string): Promise<GeoCandidate[]> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=jp&limit=4&accept-language=ja&email=mitsulow%40gmail.com&q=${encodeURIComponent(q)}`
    );
    if (!r.ok) return [];
    const list = (await r.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return list.map((e) => ({
      label: e.display_name.split(",").slice(0, 4).join("、"),
      lat: Number(e.lat),
      lng: Number(e.lon),
    }));
  } catch {
    return [];
  }
}
