import { readTecho, writeTecho } from "@/lib/techoStore";
import { createClient } from "@/lib/supabase/client";

/**
 * 手帳の予定バックアップ — わらわ〜会員だけの特典。
 * 予定・メモは localStorage(techo-memos / techo-pens) に住んでいるので、
 * 機種変更で消えるとシャレにならない。書くたびにクラウドへ静かに預け、
 * 新しいスマホでは手帳を開いた瞬間に自動復元する。
 * （RLSで INSERT/UPDATE は warawa_until が未来の会員だけに制限）
 */

let backupTimer: ReturnType<typeof setTimeout> | null = null;

/** 書き込みのたびに呼ぶ。3秒デバウンスでクラウドへ */
export function scheduleTechoBackup(userId: string) {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(async () => {
    try {
      const data = JSON.parse(readTecho());
      const pens = JSON.parse(localStorage.getItem("techo-pens") ?? "null");
      const supabase = createClient();
      await supabase
        .from("techo_backups")
        .upsert({ user_id: userId, data, pens, updated_at: new Date().toISOString() });
    } catch {}
  }, 3000);
}

/**
 * 手帳を開いた時に呼ぶ。ローカルが空でクラウドに予定があれば復元して true。
 * ローカルに既に予定がある場合は上書きしない（新しい方が正）。
 */
export async function restoreTechoIfEmpty(userId: string): Promise<boolean> {
  try {
    const local = JSON.parse(readTecho());
    if (Object.keys(local).length > 0) return false;
    const supabase = createClient();
    const { data } = await supabase.from("techo_backups").select("data, pens").eq("user_id", userId).maybeSingle();
    if (!data || !data.data || Object.keys(data.data as object).length === 0) return false;
    writeTecho(JSON.stringify(data.data));
    if (data.pens) localStorage.setItem("techo-pens", JSON.stringify(data.pens));
    return true;
  } catch {
    return false;
  }
}
