"use client";

import { createClient } from "@/lib/supabase/client";
import { readTecho, readTechoMtime, writeTecho } from "@/lib/techoStore";

/**
 * 手帳の端末間・自動同期(わらわ〜のクラウド預かりの自動運転)。
 * - 開いた時: クラウドの方が新しければ黙って取り込む(スマホ→PCが自動で揃う)
 * - 書いた時: 45秒の静けさを待ってからまとめて1回だけ預ける(打鍵ごとの通信はしない)
 * - 無料会員: 預け(書き込み)はRLSで弾かれて静かに何も起きない(読みも自分の分が無いだけ)
 * - 新旧判定は最終更新時刻の単純比較(後勝ち)。同時編集の複雑なマージはしない
 */
let started = false;

export function startTechoSync(userId: string) {
  if (started || typeof window === "undefined") return;
  started = true;
  const supabase = createClient();

  // ── 取り込み(開いた時に1回) ──
  (async () => {
    try {
      const { data } = await supabase
        .from("techo_backups")
        .select("data, pens, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!data?.data || !data.updated_at) return;
      const server = Date.parse(data.updated_at);
      if (!(server > readTechoMtime() + 2000)) return; // ローカルの方が新しい(or同じ)なら何もしない
      writeTecho(JSON.stringify(data.data), { mtime: server, silentSync: true });
      if (data.pens) localStorage.setItem("techo-pens", JSON.stringify(data.pens));
      window.dispatchEvent(new Event("onesea:techoChanged")); // 画面を更新
    } catch {}
  })();

  // ── 預け(書いたら45秒後にまとめて) ──
  let timer: ReturnType<typeof setTimeout> | null = null;
  const push = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const payload = JSON.parse(readTecho());
        const pens = JSON.parse(localStorage.getItem("techo-pens") ?? "null");
        await supabase.from("techo_backups").upsert({
          user_id: userId,
          data: payload,
          pens,
          updated_at: new Date(readTechoMtime() || Date.now()).toISOString(),
        });
      } catch {}
    }, 45000);
  };
  window.addEventListener("onesea:techoWrote", push);
  // アプリを閉じる直前にも間に合えば預ける(待ち中のものを前倒し)
  window.addEventListener("pagehide", () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    try {
      const payload = JSON.parse(readTecho());
      void supabase.from("techo_backups").upsert({
        user_id: userId,
        data: payload,
        updated_at: new Date(readTechoMtime() || Date.now()).toISOString(),
      });
    } catch {}
  });
}
