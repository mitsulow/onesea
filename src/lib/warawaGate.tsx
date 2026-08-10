"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchIsWarawa } from "@/lib/warawa";
import { UpgradeDialog } from "@/components/UpgradeGate";

/**
 * 会員区分別アクセス権限シートに基づく共通ゲート。
 * わらわ〜会員(または事務局)だけができるアクションの入口で `check()` を呼ぶ。
 * ゲスト・無料会員には UpgradeDialog(サービスLP + Googleログイン)を出す — シューマン音と同じ導線。
 */
export function useWarawaGate(lp: string) {
  const [dlg, setDlg] = useState<string | null>(null);
  const cacheRef = useRef<boolean | null>(null); // セッション中のわらわ〜判定キャッシュ

  const check = useCallback(async (feature: string): Promise<boolean> => {
    if (cacheRef.current === true) return true;
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setDlg(feature); return false; }
    const [wara, { data: adm }] = await Promise.all([
      fetchIsWarawa(session.user.id),
      supabase.from("talk_admins").select("user_id").eq("user_id", session.user.id).maybeSingle(),
    ]);
    const ok = wara || !!adm;
    cacheRef.current = ok;
    if (!ok) { setDlg(feature); return false; }
    return true;
  }, []);

  const node = <UpgradeDialog open={!!dlg} onClose={() => setDlg(null)} feature={dlg ?? undefined} lp={lp} />;
  return { check, node };
}
