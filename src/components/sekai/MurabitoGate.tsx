"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PREFS } from "@/lib/sekai";

const ALL_PREFS = [...PREFS, "海外"] as string[];

/** セカイムラに入りますか？ — 初回訪問時に一度だけ聞き、「村人になる」で🌾ムラビトバッジ+県のセカイムラへ振り分け */
export function MurabitoGate() {
  const [show, setShow] = useState(false);
  const [pref, setPref] = useState("");
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user;
      if (!u) return;
      const { data } = await supabase.from("profiles").select("murabito, prefecture").eq("id", u.id).maybeSingle();
      if (!data || data.murabito !== null) return; // 既に回答済み（true=村人 / false=辞退）
      setUid(u.id);
      setPref(ALL_PREFS.includes(data.prefecture ?? "") ? (data.prefecture as string) : "");
      setShow(true);
    });
  }, []);

  const join = async () => {
    if (!uid || !pref || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ murabito: true, prefecture: pref }).eq("id", uid);
    if (error) { alert("うまく登録できませんでした。もう一度お試しください"); setBusy(false); return; }
    // 自分の県のセカイムラ全体チャットに自動参加 → TalKのグループ欄にも現れる
    const { data: room } = await supabase.from("pref_rooms").select("id").eq("kind", "sekai").eq("prefecture", pref).maybeSingle();
    if (room) await supabase.from("pref_room_members").upsert({ room_id: room.id, user_id: uid });
    setBusy(false);
    setDone(pref.replace(/[都府県]$/, ""));
  };

  const decline = async () => {
    setShow(false);
    if (uid) await createClient().from("profiles").update({ murabito: false }).eq("id", uid);
  };

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-6">
      <div className="w-full max-w-[360px] rounded-2xl bg-white p-6 text-center">
        {done ? (
          <>
            <div className="text-[40px]">🌾</div>
            <h2 className="mt-2 text-[17px] font-extrabold text-[#1e4530]">セカイムラ{done}の村人になりました！</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5a6a54]">
              マイページに🌾ムラビトバッジが付きました。TalKに「セカイムラ{done}」のグループが追加され、同じ県のみんなとお話しできます。
            </p>
            <button onClick={() => setShow(false)} className="mt-4 w-full rounded-xl py-3 text-[14px] font-extrabold text-white" style={{ background: "#4a9a5a" }}>
              はじめる →
            </button>
          </>
        ) : (
          <>
            <div className="text-[40px]">🏡</div>
            <h2 className="mt-2 text-[17px] font-extrabold text-[#1e4530]">セカイムラに入りますか？</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#5a6a54]">
              村人になると、あなたの県の「セカイムラ◯◯」に振り分けられて、県のみんなの全体チャットに参加できます。
              マイページには🌾ムラビトバッジが付きます（無料）。
            </p>
            <select
              value={pref}
              onChange={(e) => setPref(e.target.value)}
              className="mt-3 w-full rounded-xl border border-[#d8e4d0] bg-white px-3 py-2.5 text-[13px] outline-none"
            >
              <option value="">あなたの都道府県をえらぶ</option>
              {ALL_PREFS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={join} disabled={!pref || busy} className="mt-3 w-full rounded-xl py-3 text-[14px] font-extrabold text-white disabled:opacity-40" style={{ background: "#4a9a5a" }}>
              {busy ? "登録中..." : "🌾 村人になる"}
            </button>
            <button onClick={decline} className="mt-1.5 w-full py-2 text-[12px] font-bold text-[#a09a88]">今はまだ入らない</button>
          </>
        )}
      </div>
    </div>
  );
}
