import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";

/**
 * サーバー用 Supabase クライアント（API Route 内での認証確認用）。
 * cookie からセッションを読み、ログインユーザーを特定する。
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          /* Server Component からの呼び出しでは書き込めない場合がある（読み取りのみ用途なので無視） */
        }
      },
    },
  });
}
