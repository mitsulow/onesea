import { createClient } from "@/lib/supabase/client";

/**
 * わらわ〜会員（プレミアム）判定。
 * profiles.warawa_until が未来ならわらわ〜会員。
 * 今は模擬フロー（LPの模擬ボタン→/join/complete）で付与。
 * 後日 Stripe webhook からサーバー側で warawa_until を書く実装に差し替える。
 */

/** 入会LP（OneSeaキャンペーンの中央ページ・アプリ内）。模擬決済ボタン→/join/complete。
 * 後日この模擬ボタンをStripe決済に差し替える。 */
export const WARAWA_LP_URL = "/lp/onesea";

export function isWarawaUntil(until: string | null | undefined): boolean {
  return !!until && new Date(until) > new Date();
}

export async function fetchIsWarawa(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const supabase = createClient();
  const { data } = await supabase.from("profiles").select("warawa_until").eq("id", userId).maybeSingle();
  return isWarawaUntil(data?.warawa_until as string | null);
}

/** わらわ〜会員がまだ入力していない必須項目（マイページのバッジ数になる） */
export interface WarawaMissing {
  isWara: boolean;
  missing: Array<"phone" | "city" | "ddp">;
}

export async function fetchWarawaMissing(userId: string | null | undefined): Promise<WarawaMissing> {
  if (!userId) return { isWara: false, missing: [] };
  const supabase = createClient();
  const [{ data: prof }, { data: priv }, { data: ddp }] = await Promise.all([
    supabase.from("profiles").select("warawa_until, prefecture, city").eq("id", userId).maybeSingle(),
    supabase.from("private_profiles").select("phone").eq("user_id", userId).maybeSingle(),
    supabase.from("ddp").select("body").eq("user_id", userId).maybeSingle(),
  ]);
  const isWara = isWarawaUntil(prof?.warawa_until as string | null);
  if (!isWara) return { isWara: false, missing: [] };
  const missing: WarawaMissing["missing"] = [];
  if (!priv?.phone) missing.push("phone");
  if (!prof?.prefecture || !prof?.city) missing.push("city");
  if (!ddp?.body) missing.push("ddp");
  return { isWara, missing };
}
