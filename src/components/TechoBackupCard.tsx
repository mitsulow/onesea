"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isWarawaUntil } from "@/lib/warawa";
import { readTecho, writeTecho } from "@/lib/techoStore";

/**
 * ☁ 手帳バックアップの見える化（設定ページ）。
 * わらわ〜は自動バックアップ済み — ここは「安心確認+手動ボタン」。
 * TalKは元からサーバー保存なので機種変更時の操作は不要。
 */
export function TechoBackupCard({ userId }: { userId: string }) {
  const [wara, setWara] = useState<boolean | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "up" | "down">("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const supabase = createClient();
    const [{ data: prof }, { data: bk }] = await Promise.all([
      supabase.from("profiles").select("warawa_until").eq("id", userId).maybeSingle(),
      supabase.from("techo_backups").select("updated_at").eq("user_id", userId).maybeSingle(),
    ]);
    setWara(isWarawaUntil(prof?.warawa_until as string | null));
    setLastAt((bk?.updated_at as string) ?? null);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const backupNow = async () => {
    setBusy("up");
    setMsg(null);
    try {
      const data = JSON.parse(readTecho());
      const pens = JSON.parse(localStorage.getItem("techo-pens") ?? "null");
      const supabase = createClient();
      const { error } = await supabase
        .from("techo_backups")
        .upsert({ user_id: userId, data, pens, updated_at: new Date().toISOString() });
      if (error) setMsg("バックアップできませんでした（わらわ〜会員の機能です）");
      else {
        setMsg("☁ 預けました");
        refresh();
      }
    } catch {
      setMsg("バックアップに失敗しました");
    }
    setBusy("");
  };

  const restoreNow = async () => {
    if (!confirm("クラウドに預けてある予定で、このスマホの手帳を置き換えます。よろしいですか？")) return;
    setBusy("down");
    setMsg(null);
    try {
      const supabase = createClient();
      const { data } = await supabase.from("techo_backups").select("data, pens").eq("user_id", userId).maybeSingle();
      if (!data?.data) {
        setMsg("クラウドに預かっている予定がありません");
      } else {
        writeTecho(JSON.stringify(data.data));
        if (data.pens) localStorage.setItem("techo-pens", JSON.stringify(data.pens));
        window.dispatchEvent(new Event("onesea:techoChanged"));
        setMsg("📥 このスマホに復元しました");
      }
    } catch {
      setMsg("復元に失敗しました");
    }
    setBusy("");
  };

  return (
    <div className="rounded-2xl border border-[#e8dcc4] bg-[#fffaf0] p-3.5">
      <div className="text-[12.5px] font-extrabold text-[#8a7a5a]">☁ 手帳のバックアップ（機種変更のとき）</div>
      {wara === false ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#a09888]">
          手帳の予定はこのスマホの中に保存されています。
          <a href="/lp/onesea" className="font-bold text-[#c94d3a] underline">わらわ〜会員</a>になると、
          自動でクラウドに預かり、機種変更しても消えなくなります。
        </p>
      ) : (
        <>
          <p className="mt-1 text-[11.5px] leading-relaxed text-[#8a8070]">
            予定は書くたびに自動でクラウドへ預けています。新しいスマホでは、ログインして手帳を開くだけで自動復元。
            <br />
            <span className="font-bold text-[#5a8a5a]">
              最終バックアップ: {lastAt ? new Date(lastAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "まだ（予定を書くと始まります）"}
            </span>
            <br />
            <span className="text-[10.5px] text-[#b0a890]">※TalKの会話は元からサーバー保存なので、機種変更の操作は不要です</span>
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={backupNow}
              disabled={busy !== ""}
              className="flex-1 rounded-xl border-2 border-[#5a8a5a] py-2 text-[12px] font-extrabold text-[#3a6a3a] disabled:opacity-40"
            >
              {busy === "up" ? "預けています…" : "☁ いますぐ預ける"}
            </button>
            <button
              onClick={restoreNow}
              disabled={busy !== ""}
              className="flex-1 rounded-xl border-2 border-[#8a7a5a] py-2 text-[12px] font-extrabold text-[#6a5a3a] disabled:opacity-40"
            >
              {busy === "down" ? "復元中…" : "📥 このスマホに復元"}
            </button>
          </div>
        </>
      )}
      {msg && <p className="mt-1.5 text-center text-[11.5px] font-bold text-[#5a8a5a]">{msg}</p>}
    </div>
  );
}
