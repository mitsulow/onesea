"use client";

/** サービス初回説明 + 小さな入会ボタン（様子見OK方式・2026-08-13ユーザー確定）。
 *  - 各サービスの上部に目立たない小さなボタン（村人になる / MMMのメンバーになる / ツキヨガに入る）
 *  - 初回訪問時は説明が自動で開く。押し付けない：「まずは様子を見る」でいつでも閉じられる
 *  - MMMにしか興味がないセカイムラ様子見組、セカイムラだけのMMM様子見組、どちらもOK
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Svc = "sekai" | "mmm" | "tsukiyoga";

const COPY: Record<Svc, { btn: string; title: string; body: string[]; joinLabel: string; joinedLabel: string; accent: string }> = {
  sekai: {
    btn: "村人になる",
    title: "セカイムラとは",
    body: [
      "「じぶんのこと、じぶんでできる」\n村人を世界に増やすコミュニティです。",
      "お味噌づくりや、米作り、醤油づくりに、畑や田んぼ。\n古民家を改修して皆で集まる。",
      "ナチュラルな生活に興味がある人はご参加ください。",
      "まずは、毎月2回開催されるズームでの「セカイムラ新月会・セカイムラ満月会」に参加してみて、\nそれから「村人になる」のがおススメです。",
    ],
    joinLabel: "村人になる（お住まいの県を選ぶ）",
    joinedLabel: "あなたは村人です",
    accent: "#2a7a48",
  },
  mmm: {
    btn: "MMMのメンバーになる",
    title: "MasterMindMembersとは",
    body: [
      "「夢とヒラメキの保管庫」。",
      "地球のシューマン共振と同調しながら夢を保管し、\n世界中の仲間と同じ音でつながるマスターマインドです。",
      "まずはOTOHIKARIの地球儀を眺めて、シューマン音©を聴いてみて、\nそれから「メンバーになる」のがおススメです。",
    ],
    joinLabel: "MMMのメンバーになる",
    joinedLabel: "あなたはMMMメンバーです",
    accent: "#1a8a6a",
  },
  tsukiyoga: {
    btn: "ツキヨガに入る",
    title: "ツキヨガとは",
    body: [
      "月を想う、女性のためのツキヨガ。",
      "暦・月ナビ・占い・写真 — 月と暮らすための道具がそろっています。",
      "まずは今日の月を眺めてみて、\nそれから「入る」のがおススメです。",
    ],
    joinLabel: "ツキヨガに入る",
    joinedLabel: "あなたはツキヨガの一員です",
    accent: "#7a5fd0",
  },
};

const FLAG: Record<Svc, "murabito" | "mmm_member" | "tsukiyoga_member"> = {
  sekai: "murabito",
  mmm: "mmm_member",
  tsukiyoga: "tsukiyoga_member",
};

export function ServiceIntro({ svc }: { svc: Svc }) {
  const c = COPY[svc];
  const [open, setOpen] = useState(false);
  const [member, setMember] = useState<boolean | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const seenKey = `onesea-intro-${svc}`;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user?.id ?? null;
      setUid(u);
      let m = false;
      if (u) {
        const { data } = await supabase.from("profiles").select(FLAG[svc]).eq("id", u).maybeSingle();
        m = !!(data as Record<string, boolean> | null)?.[FLAG[svc]];
      }
      setMember(m);
      // 初回訪問(未所属)なら説明を自動で開く
      try {
        if (!m && !localStorage.getItem(seenKey)) {
          setOpen(true);
          localStorage.setItem(seenKey, "1");
        }
      } catch { /* noop */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svc]);

  const join = async () => {
    if (!uid) { location.href = "/login?return=" + encodeURIComponent(location.pathname); return; }
    if (svc === "sekai") {
      // 村人になる=お住まいの県のセカイムラに必ず所属する方式(県ページで参加)
      setOpen(false);
      location.href = "/sekai#pref-rooms";
      return;
    }
    const supabase = createClient();
    await supabase.from("profiles").update({ [FLAG[svc]]: true }).eq("id", uid);
    setMember(true);
  };

  if (member === null) return null;

  return (
    <>
      {/* 目立たない小さなボタン（未所属の人にだけ） */}
      {!member && (
        <div className="flex justify-center py-1">
          <button
            onClick={() => setOpen(true)}
            className="rounded-full border px-3 py-1 text-[10.5px] font-bold"
            style={{ borderColor: `${c.accent}55`, color: c.accent, background: "rgba(255,255,255,.6)" }}
          >
            {c.btn}
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 px-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[380px] overflow-y-auto rounded-2xl bg-white p-6" style={{ maxHeight: "82vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-bold tracking-[3px]" style={{ color: c.accent }}>{c.title}</div>
            {c.body.map((t, i) => (
              <p key={i} className={`whitespace-pre-wrap text-[13.5px] leading-loose text-[#3a4038] ${i === 0 ? "mt-3 font-extrabold" : "mt-3"}`}>
                {t}
              </p>
            ))}
            <button
              onClick={join}
              className="mt-5 w-full rounded-2xl py-3.5 text-[14px] font-extrabold text-white"
              style={{ background: c.accent }}
            >
              {member ? c.joinedLabel : c.joinLabel}
            </button>
            <button onClick={() => setOpen(false)} className="mt-2 w-full rounded-2xl border border-[#e0e2da] bg-white py-3 text-[13px] font-bold text-[#8a9080]">
              まずは様子を見る
            </button>
          </div>
        </div>
      )}
    </>
  );
}
