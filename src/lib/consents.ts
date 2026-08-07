import { createClient } from "@/lib/supabase/client";

/**
 * 法的な同意チェック（初回利用前のダイアログ）。
 * 同意はDB(user_consents)に記録して証跡を残し、localStorageにキャッシュして毎回の照会を省く。
 * kind: "techo"(手帳=データ消失) / "cotozute"(投稿ポリシー) / "za"(出店の法令遵守)
 */
export type ConsentKind = "techo" | "cotozute" | "za";

const lsKey = (uid: string, kind: ConsentKind) => `onesea-consent:${uid}:${kind}`;

export async function hasConsent(userId: string, kind: ConsentKind): Promise<boolean> {
  try {
    if (localStorage.getItem(lsKey(userId, kind)) === "1") return true;
  } catch {}
  const supabase = createClient();
  const { data } = await supabase
    .from("user_consents")
    .select("kind")
    .eq("user_id", userId)
    .eq("kind", kind)
    .maybeSingle();
  if (data) {
    try {
      localStorage.setItem(lsKey(userId, kind), "1");
    } catch {}
    return true;
  }
  return false;
}

export async function giveConsent(userId: string, kind: ConsentKind): Promise<void> {
  const supabase = createClient();
  await supabase.from("user_consents").upsert({ user_id: userId, kind });
  try {
    localStorage.setItem(lsKey(userId, kind), "1");
  } catch {}
}
