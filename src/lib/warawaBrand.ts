"use client";

// わらわ〜会員のブランド表示: 卵+「OneSea」→ 大天使ワラエル+「WaraWer」に変わる。
// 判定は端末キャッシュ(onesea-warawa)で1フレーム目から反映→裏でprofiles.warawa_untilを確認。
// 静的ページ(schumann1/tsukiyoga-v7)も同じlocalStorageキーを読む。

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isWarawaUntil } from "@/lib/warawa";

export const WARAERU_ICON = "/icons/waraeru.png";
export const WARAWER_LABEL = "WaraWer";

export function cachedWarawa(): boolean {
  try {
    return localStorage.getItem("onesea-warawa") === "1";
  } catch {
    return false;
  }
}

export async function refreshWarawa(): Promise<boolean> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) {
    try { localStorage.removeItem("onesea-warawa"); } catch { /* noop */ }
    return false;
  }
  const { data } = await supabase.from("profiles").select("warawa_until").eq("id", uid).maybeSingle();
  const w = isWarawaUntil((data?.warawa_until as string | null) ?? null);
  try { localStorage.setItem("onesea-warawa", w ? "1" : "0"); } catch { /* noop */ }
  return w;
}

/** わらわ〜会員か。キャッシュで即答→裏で最新化 */
export function useWarawa(): boolean {
  const [w, setW] = useState(false);
  useEffect(() => {
    setW(cachedWarawa());
    refreshWarawa().then(setW).catch(() => {});
  }, []);
  return w;
}
