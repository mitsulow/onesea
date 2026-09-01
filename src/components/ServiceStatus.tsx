"use client";

import { useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/**
 * サーバー（Supabase API）に繋がらない時だけ、画面上部に「アクセス集中」の帯を出す。
 * わらわ〜ボランティア公開初日の障害（2026-08-16・Nanoの窓口プロセス落ち）の移植。
 * 8秒以内に応答が無ければ障害とみなし、30秒ごとに再確認。復帰したら消える。
 * ensureAuthAlive() が失敗した時も onesea:serviceDown 経由で即表示される。
 */
export function ServiceStatus() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (alive) setDown(!(res.ok || res.status === 401 || res.status === 404));
      } catch {
        if (alive) setDown(true);
      } finally {
        clearTimeout(t);
      }
    };
    check();
    const onDown = () => {
      if (alive) setDown(true);
    };
    window.addEventListener("onesea:serviceDown", onDown);
    const timer = setInterval(() => {
      // 平常時はタブ非表示中を打たない。障害表示中だけは裏でも回復を見張る（戻った瞬間に赤帯が消えているように）
      if (!document.hidden || down) check();
    }, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("onesea:serviceDown", onDown);
    };
  }, [down]);

  if (!down) return null;
  return (
    <div
      className="sticky top-0 z-[200] px-4 py-2.5 text-center text-[13.5px] font-extrabold leading-snug text-white"
      style={{ background: "#c0392b" }}
    >
      ただ今アクセス集中により繋がりません。10分後にまたお入りください🙏
      <span className="mt-0.5 block text-[11px] font-medium opacity-90">（投稿やデータは消えていません。しばらくお待ちください）</span>
    </div>
  );
}

/**
 * ログインボタン用の前段チェック。Auth窓口に8秒で繋がらなければ false を返し、
 * 赤帯（ServiceStatus）を即表示する。「Googleへ移動中…」のまま固まる事故の対策。
 */
export async function ensureAuthAlive(timeoutMs = 8000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (res.ok) return true;
  } catch {
    /* fallthrough */
  } finally {
    clearTimeout(t);
  }
  try {
    window.dispatchEvent(new Event("onesea:serviceDown"));
  } catch {}
  return false;
}
