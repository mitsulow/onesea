"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isTalkAdmin } from "@/lib/line";
import { srcCdn, uploadImage } from "@/lib/images";
import { PREFS } from "@/lib/sekai";
import TopTone from "@/components/TopTone";
import { AvatarMenu } from "@/components/AvatarMenu";

/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-explicit-any */

/**
 * 事務局 > 米部 — 「田んぼを使って欲しい」申請の受信箱。
 * 申請内容を確認し、写真などを足して「この田んぼを登録する」を押すと
 * セカイムラ米部に田んぼページが増える(申請者が田守になる)。
 */
export default function OfficeKomePage() {
  const [me, setMe] = useState<User | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [showDone, setShowDone] = useState(false);
  // 登録フォーム(申請ごとに開く)
  const [openId, setOpenId] = useState<string | null>(null);
  const [rName, setRName] = useState("");
  const [rPref, setRPref] = useState("東京都");
  const [rNote, setRNote] = useState("");
  const [rPhoto, setRPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tanbo_applications")
      .select("*, profiles!tanbo_applications_user_id_fkey(username, display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(100);
    setApps(data ?? []);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      if (!u) { setOk(false); return; }
      const admin = await isTalkAdmin(u.id);
      setOk(admin);
      if (admin) load();
    });
  }, [load]);

  const openRegister = (a: any) => {
    setOpenId(a.id);
    setRName(a.tanbo_name || `${a.applicant_name}さんの田んぼ`);
    setRPref(a.prefecture ?? "東京都");
    setRNote([a.address_detail ? `${a.prefecture}${a.city} ${a.address_detail}` : `${a.prefecture}${a.city}`, `作り手: ${a.farmer_who}`, `農家区分: ${a.farmer_type}`].join(" / "));
    setRPhoto(null);
  };

  const register = async (a: any) => {
    if (busy) return;
    if (!rName.trim()) { alert("田んぼの名前を入れてください"); return; }
    if (!confirm(`「${rName.trim()}」を米部に登録しますか？（申請者が田守になります）`)) return;
    setBusy(true);
    const supabase = createClient();
    const { data: newId, error } = await supabase.rpc("office_register_tanbo", {
      p_app: a.id,
      p_name: rName.trim(),
      p_pref: rPref,
      p_note: rNote.trim(),
      p_photo: rPhoto ?? "",
    });
    setBusy(false);
    if (error || !newId) {
      alert("登録できませんでした: " + (error?.message ?? ""));
      return;
    }
    setOpenId(null);
    alert("田んぼを登録しました🌾");
    load();
    window.open(`/sekai/kome/${newId}`, "_blank");
  };

  if (ok === null) return <main className="p-8 text-center text-sm text-[#999]">確認中…</main>;
  if (!ok)
    return (
      <main className="p-8 text-center">
        <p className="text-sm text-[#666]">このページは事務局メンバーだけが開けます</p>
        <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#c94d3a] underline">OneSeaトップへ</Link>
      </main>
    );

  const pending = apps.filter((a) => a.status === "pending");
  const done = apps.filter((a) => a.status !== "pending");
  const shown = showDone ? done : pending;

  return (
    <main className="pb-24" style={{ background: "#f7f4ec", minHeight: "100dvh" }}>
      <TopTone color="#1a2432" />
      <header className="sticky top-0 z-40 flex items-center gap-3 px-4 pb-3 pt-3.5" style={{ background: "#1a2432" }}>
        <Link href="/office" className="text-[15px] font-bold text-[#d4b96a] no-underline">◀</Link>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold leading-tight text-[#f0e6c8]">事務局 — 米部 🌾</div>
          <div className="text-[10px] text-[#7a9ab4]">「田んぼを使って欲しい」の申請を確認して登録</div>
        </div>
        <AvatarMenu />
      </header>

      <div className="mx-auto max-w-md space-y-3 px-3 pt-4">
        <div className="flex gap-2">
          <button onClick={() => setShowDone(false)} className="flex-1 rounded-full py-2 text-[12px] font-extrabold" style={!showDone ? { background: "#a08a30", color: "#fff" } : { background: "#fff", color: "#a09060", border: "1px solid #e5dcc8" }}>未対応 {pending.length}件</button>
          <button onClick={() => setShowDone(true)} className="flex-1 rounded-full py-2 text-[12px] font-extrabold" style={showDone ? { background: "#a08a30", color: "#fff" } : { background: "#fff", color: "#a09060", border: "1px solid #e5dcc8" }}>登録済み {done.length}件</button>
        </div>

        {shown.length === 0 ? (
          <p className="py-10 text-center text-[12.5px] text-[#a09a88]">{showDone ? "登録済みの申請はまだありません" : "未対応の申請はありません🌾"}</p>
        ) : (
          shown.map((a) => (
            <div key={a.id} className="rounded-2xl bg-white p-3.5" style={{ border: "1px solid #e5dcc8" }}>
              <div className="flex items-center gap-2.5">
                {a.profiles?.avatar_url ? <img src={srcCdn(a.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2edda] text-[15px]">🌾</span>}
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-extrabold text-[#3a3428]">{a.applicant_name}</div>
                  <div className="num text-[10px] text-[#a09a88]">{new Date(a.created_at).getMonth() + 1}/{new Date(a.created_at).getDate()} 申請{a.profiles?.username ? ` ・ @${a.profiles.username}` : ""}</div>
                </div>
                {a.status !== "pending" && <span className="flex-shrink-0 rounded-full bg-[#e8f4ec] px-2 py-0.5 text-[10px] font-bold text-[#2a7a48]">✓ 登録済み</span>}
              </div>
              <div className="mt-2 space-y-1 rounded-xl bg-[#faf8f0] p-2.5 text-[12.5px] leading-relaxed text-[#4a4438]">
                <div>📱 {a.phone} ／ ✉️ {a.email}</div>
                <div>📍 {a.prefecture}{a.city}{a.address_detail ? ` ${a.address_detail}` : ""}</div>
                <div>👤 お米作り: <b>{a.farmer_who}</b> ／ 区分: <b>{a.farmer_type}</b></div>
                {a.tanbo_name && <div>🌾 田んぼの名前: <b>{a.tanbo_name}</b></div>}
              </div>

              {a.status === "pending" && (openId === a.id ? (
                <div className="mt-2.5 rounded-xl border border-[#e0d8b8] bg-[#fdfcf6] p-2.5">
                  <div className="mb-1 text-[11px] font-bold text-[#8a7020]">田んぼの名前</div>
                  <input value={rName} onChange={(e) => setRName(e.target.value)} className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[13.5px] outline-none" />
                  <div className="mb-1 text-[11px] font-bold text-[#8a7020]">都道府県</div>
                  <select value={rPref} onChange={(e) => setRPref(e.target.value)} className="mb-2 w-full rounded-xl border border-[#e8e2cc] bg-white px-2 py-2 text-[13px] outline-none">
                    {PREFS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                  <div className="mb-1 text-[11px] font-bold text-[#8a7020]">ひとこと（ページに表示されます）</div>
                  <textarea value={rNote} onChange={(e) => setRNote(e.target.value)} rows={2} className="mb-2 w-full resize-y rounded-xl border border-[#e8e2cc] bg-white px-3 py-2 text-[12.5px] outline-none" />
                  <div className="mb-2 flex items-center gap-2">
                    {rPhoto && <img src={srcCdn(rPhoto)} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#e8e2cc] bg-white px-3 py-2 text-[12px] font-bold text-[#8a7020]">
                      {rPhoto ? "📷 写真を変える" : "📷 写真を入れる"}
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setRPhoto(await uploadImage("post-images", me.id, f, 1600, 0.75)); }} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setOpenId(null)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#a09a88]">とじる</button>
                    <button onClick={() => register(a)} disabled={busy || !rName.trim()} className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-white disabled:opacity-40" style={{ background: "#2a7a48" }}>{busy ? "登録中..." : "🌾 この田んぼを登録する"}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => openRegister(a)} className="mt-2.5 w-full rounded-xl border-2 border-dashed py-2.5 text-[13px] font-extrabold" style={{ borderColor: "#a08a3066", color: "#8a7020" }}>
                  🌾 この田んぼを登録する（内容を確認して写真を追加）
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
