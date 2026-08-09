"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { srcCdn, uploadImage } from "@/lib/images";
import { SekaiShell, TasuketeSection, useSekaiMe } from "@/components/sekai/sections";

/** 助けて — 災害時のコミュニティのページ（大見出し＋背景/アイコン＋これまでの取り組み＋掲示板） */
export default function SekaiTasuketePage() {
  const router = useRouter();
  const { me, myPref } = useSekaiMe();
  const [page, setPage] = useState<{ cover_url: string | null; icon_url: string | null }>({ cover_url: null, icon_url: null });
  const [acts, setActs] = useState<any[]>([]);
  const [amAdmin, setAmAdmin] = useState(false);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: pg }, { data: ap }] = await Promise.all([
      supabase.from("help_page").select("cover_url, icon_url").eq("id", 1).maybeSingle(),
      supabase.from("help_posts").select("id, body, photo_url, created_at, user_id, profiles!help_posts_user_id_fkey(username, display_name, avatar_url)").order("created_at", { ascending: false }).limit(50),
    ]);
    if (pg) setPage(pg);
    setActs(ap ?? []);
  }, []);
  useEffect(() => {
    load();
    if (me) import("@/lib/line").then(({ isTalkAdmin }) => isTalkAdmin(me.id).then(setAmAdmin)).catch(() => {});
  }, [load, me]);

  const changeImage = async (which: "cover" | "icon", f: File | null) => {
    if (!f || !me) return;
    const url = await uploadImage("post-images", me.id, f, which === "cover" ? 1600 : 512, which === "cover" ? 0.75 : 0.8);
    if (url) {
      await createClient().from("help_page").update({ [which === "cover" ? "cover_url" : "icon_url"]: url, updated_by: me.id }).eq("id", 1);
      load();
    }
  };

  const postAct = async () => {
    if (!me || !body.trim() || saving) return;
    setSaving(true);
    await createClient().from("help_posts").insert({ user_id: me.id, body: body.trim(), photo_url: photo });
    setSaving(false);
    setWriting(false); setBody(""); setPhoto(null);
    load();
  };

  return (
    <SekaiShell>
      {/* 大見出し + 背景 */}
      <section className="card overflow-hidden p-0" style={{ border: "none" }}>
        <div className="relative flex min-h-[128px] items-center justify-center px-4 py-6 text-center" style={{ background: page.cover_url ? `linear-gradient(160deg, rgba(10,20,30,.5), rgba(14,30,44,.66)), url(${page.cover_url}) center/cover` : "linear-gradient(150deg,#0e2a3e,#173a52)" }}>
          <h1 className="text-[19px] font-extrabold leading-relaxed tracking-[2px] text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}>
            災害時における<br />コミュニティのありかた
          </h1>
          {me && (
            <label className="absolute bottom-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[13px] shadow">📷
              <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("cover", e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <label className={me ? "relative -mt-9 cursor-pointer" : "relative -mt-9"}>
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-[#0e2a3e] text-[22px] shadow-lg">
              {page.icon_url ? <img src={srcCdn(page.icon_url)} alt="" className="h-full w-full object-cover" /> : "🤝"}
            </span>
            {me && <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] shadow">📷</span>}
            {me && <input type="file" accept="image/*" className="hidden" onChange={(e) => changeImage("icon", e.target.files?.[0] ?? null)} />}
          </label>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold text-[#1c3448]">セカイムラ 助け合い</div>
            <div className="text-[10.5px] text-[#7a9aae]">「助けて」と言えるのが、家族</div>
          </div>
        </div>
      </section>

      {/* これまでの取り組み */}
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] font-extrabold tracking-[1px] text-[#1c3448]">これまでの取り組み</span>
          {me && <button onClick={() => setWriting((w) => !w)} className="rounded-full px-3 py-1 text-[11px] font-extrabold text-white" style={{ background: "#2a6a8a" }}>{writing ? "とじる" : "＋ 記録する"}</button>}
        </div>
        {writing && me && (
          <div className="mb-3 rounded-xl border border-[#dbe6ec] bg-[#f6fafc] p-2.5">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="例: ◯◯地震のとき、拠点で炊き出しと物資の分配をしました" className="mb-2 w-full resize-y rounded-xl border border-[#dbe6ec] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#2a6a8a]" />
            <div className="flex items-center gap-2">
              {photo && <img src={srcCdn(photo)} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-[#dbe6ec] bg-white px-3 py-1.5 text-[12px] font-bold text-[#2a6a8a]">📷 写真
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && me) setPhoto(await uploadImage("post-images", me.id, f, 640, 0.55)); }} />
              </label>
              <button onClick={postAct} disabled={!body.trim() || saving} className="ml-auto rounded-xl px-4 py-1.5 text-[13px] font-extrabold text-white disabled:opacity-40" style={{ background: "#2a6a8a" }}>{saving ? "投稿中..." : "記録する"}</button>
            </div>
          </div>
        )}
        {acts.length === 0 ? (
          <p className="py-2 text-[12px] text-[#a0aca0]">まだ取り組みの記録がありません</p>
        ) : (
          <div className="space-y-2.5">
            {acts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[#eef2ec] bg-white p-3">
                <div className="flex items-center gap-2">
                  {a.profiles?.avatar_url ? <img src={srcCdn(a.profiles.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dbe6ec] text-[11px]">🤝</span>}
                  <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-bold text-[#3a4a34]">{a.profiles?.display_name ?? "むらびと"}</div><div className="num text-[10px] text-[#a0aca0]">{new Date(a.created_at).getMonth() + 1}/{new Date(a.created_at).getDate()}</div></div>
                  {me && (me.id === a.user_id || amAdmin) && <button onClick={async () => { if (!confirm("削除しますか？")) return; await createClient().from("help_posts").delete().eq("id", a.id); load(); }} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f0f2f5] text-[12px] text-[#8a9a9a]">×</button>}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-[#3a4a3e]">{a.body}</p>
                {a.photo_url && <img src={srcCdn(a.photo_url)} alt="" loading="lazy" className="mt-2 max-h-80 w-full rounded-xl object-cover" />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 掲示板（従来の助けて掲示板） */}
      <TasuketeSection me={me} myPref={myPref} router={router} />
    </SekaiShell>
  );
}
