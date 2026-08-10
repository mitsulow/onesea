"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { srcCdn } from "@/lib/images";
import { PREFS } from "@/lib/sekai";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";

const GOLD = "#d4b96a";

/** 🔍 人物検索（わらわ〜名鑑） — わらわ〜会員を名前・県・スキルで探せる会員名簿 */
export default function MeikanPage() {
  const [me, setMe] = useState<User | null>(null);
  const [q, setQ] = useState("");
  const [pref, setPref] = useState("");
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => setMe(session?.user ?? null));
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      const supabase = createClient();
      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, prefecture, city, status_line, skills, member_no, murabito")
        .gt("warawa_until", new Date().toISOString())
        .not("username", "is", null)
        .order("member_no", { ascending: true, nullsFirst: false })
        .limit(60);
      if (pref) query = query.eq("prefecture", pref);
      if (q.trim()) query = query.or(`display_name.ilike.%${q.trim()}%,username.ilike.%${q.trim()}%,status_line.ilike.%${q.trim()}%`);
      const { data } = await query;
      setRows(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [q, pref]);

  void me;
  return (
    <main className="pb-24" style={{ background: "#fffdf8", minHeight: "100dvh" }}>
      <TopTone color="#fffdf8" />
      <header className="sticky top-0 z-40 border-b border-[#ede5d8] bg-[#fffdf8]/95 backdrop-blur-sm">
        <div className="flex h-[52px] items-center justify-between px-4">
          <span className="text-[16px] font-extrabold tracking-[2px] text-[#3a3428]">🔍 わらわ〜名鑑<span className="ml-1 text-[11px] font-bold" style={{ color: "#a08030" }}>（人物検索）</span></span>
          <AvatarMenu ring="#c94d3a" />
        </div>
      </header>

      <div className="mx-auto max-w-[480px] px-3 pt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・ひとことで探す..."
          className="w-full rounded-xl border-2 px-3.5 py-2.5 text-[14px] outline-none"
          style={{ borderColor: GOLD, background: "#fff" }}
        />
        <select
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[#e5dcc8] bg-white px-3 py-2.5 text-[13px] font-bold text-[#8a7a5a] outline-none"
        >
          <option value="">🌏 全国のわらわ〜会員</option>
          {[...PREFS, "海外"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <div className="mt-3 space-y-2">
          {rows === null ? (
            <p className="py-8 text-center text-[12.5px] text-[#a09888]">読み込み中...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] leading-relaxed text-[#a09888]">見つかりませんでした。<br />条件を変えてみてください</p>
          ) : (
            rows.map((p) => (
              <Link
                key={p.id}
                href={`/u/${p.username}`}
                className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 no-underline shadow-sm"
                style={{ border: "1px solid #ede5d8" }}
              >
                {p.avatar_url
                  ? <img src={srcCdn(p.avatar_url)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
                  : <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece0] text-[16px]">📔</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-extrabold text-[#3a3428]">{p.display_name ?? "むらびと"}</span>
                    {p.member_no != null && (
                      <span className="num flex-shrink-0 rounded px-1 py-0.5 text-[8.5px] font-extrabold tracking-wider text-[#7a5a10]" style={{ background: "linear-gradient(135deg,#f8e8b0,#e8cc70)" }}>
                        No.{String(p.member_no).padStart(7, "0")}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-[#a09888]">
                    {p.prefecture ?? ""}{p.city ? ` ${p.city}` : ""}
                    {p.status_line ? ` ・ ${p.status_line}` : ""}
                  </div>
                  {Array.isArray(p.skills) && p.skills.length > 0 && (
                    <div className="mt-0.5 truncate text-[10px] text-[#b0a080]">{p.skills.slice(0, 4).join(" / ")}</div>
                  )}
                </div>
                <span className="flex-shrink-0 text-[12px] text-[#c0b8a8]">›</span>
              </Link>
            ))
          )}
        </div>
        <p className="mt-4 text-center text-[10.5px] leading-relaxed text-[#b0a898]">
          わらわ〜名鑑には、わらわ〜会員だけが載ります。<br />気になる人のページから名刺を見て、TalKで連絡できます
        </p>
      </div>
    </main>
  );
}
