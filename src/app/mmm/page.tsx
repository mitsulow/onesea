"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Otohikari } from "@/components/Otohikari";
import { SchumannAudioPlayer } from "@/components/SchumannAudioPlayer";
import { CotozuteFeed } from "@/components/CotozuteFeed";
import { PriceBanner } from "@/components/PriceBanner";
import {
  NEURA_SIZE,
  NeuraTeam,
  fetchMyDdp,
  saveMyDdp,
  myNeuraTeam,
  joinNeura,
  leaveNeura,
} from "@/lib/mmm";

/* eslint-disable @next/next/no-img-element */

/**
 * MasterMindMembers — MMMのサイト本体。
 * ① OTOHIKARI MAP ② シューマン音 ③ Cotozute（共有コンポーネント）
 * ④ ニューラ活動（同じ市町村の5人1チーム・冬至までに互いのDDPを叶える）
 * ⑤ DDP（短い夢）の設定
 */

const GREEN_NEON = {
  color: "#7de0a0",
  textShadow: "0 0 8px rgba(110,230,150,.9), 0 0 20px rgba(70,210,120,.5)",
};

export default function MmmPage() {
  const [me, setMe] = useState<User | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [myPref, setMyPref] = useState<string>("");
  const [myCity, setMyCity] = useState<string | null>(null);

  /* DDP */
  const [ddp, setDdp] = useState("");
  const [ddpEdit, setDdpEdit] = useState(false);
  const [ddpDraft, setDdpDraft] = useState("");
  const [ddpSaving, setDdpSaving] = useState(false);

  /* ニューラ班 */
  const [team, setTeam] = useState<NeuraTeam | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setMe(u);
      setAvatar((u?.user_metadata?.avatar_url as string) ?? null);
      if (!u) {
        setTeam(null);
        return;
      }
      const { data: prof } = await supabase
        .from("profiles")
        .select("prefecture, city")
        .eq("id", u.id)
        .maybeSingle();
      setMyPref(prof?.prefecture ?? "");
      setMyCity(prof?.city ?? null);
      setDdp(await fetchMyDdp(u.id));
      setTeam(await myNeuraTeam(u.id));
    });
  }, []);

  const saveDdp = async () => {
    if (!me || ddpSaving) return;
    setDdpSaving(true);
    await saveMyDdp(me.id, ddpDraft);
    setDdp(ddpDraft.trim());
    setDdpSaving(false);
    setDdpEdit(false);
    if (team) setTeam(await myNeuraTeam(me.id)); // 班表示のDDPも更新
  };

  const join = async () => {
    if (!me || joining || !myPref) return;
    setJoining(true);
    await joinNeura(me.id, myPref, myCity);
    setTeam(await myNeuraTeam(me.id));
    setJoining(false);
  };

  return (
    <main className="pb-24">
      {/* ヒーロー（薄い帯） */}
      <header className="relative flex items-center justify-center px-6 py-2" style={{ background: "#0a1410" }}>
        <div className="text-center">
          <div className="text-[17px] font-extrabold tracking-[3px]" style={GREEN_NEON}>
            MasterMindMembers
          </div>
        </div>
        <Link href="/my" aria-label="マイページ" className="absolute right-3 top-1/2 -translate-y-1/2">
          {avatar ? (
            <img src={avatar} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border-2 border-[#7de0a0]/60 object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#7de0a0]/60 text-base">☀️</span>
          )}
        </Link>
      </header>
      <PriceBanner service="MasterMindMembers" price="年会費39,600円" color="#7de0a0" />

      {/* ① OTOHIKARI MAP + ② シューマン音 */}
      <div className="px-4">
        <Otohikari />
        <SchumannAudioPlayer />
      </div>

      {/* ⑤ わたしのDDP */}
      <section className="card" style={{ background: "linear-gradient(150deg,#0f1a25,#16251a)", border: "none" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-extrabold tracking-[2px]" style={GREEN_NEON}>
            🌊 わたしのDDP
          </span>
          <span className="text-[10px] text-[#5a7a68]">短い夢を、明確に持つ</span>
        </div>
        {ddpEdit ? (
          <div className="mt-2">
            <textarea
              value={ddpDraft}
              onChange={(e) => setDdpDraft(e.target.value)}
              rows={2}
              maxLength={60}
              autoFocus
              placeholder="例: カレー屋を開きたい / 屋久島に行きたい"
              className="w-full resize-y rounded-xl border border-[#2a4a3a] bg-[#0c1812] p-3 text-center text-[15px] leading-relaxed text-[#d8f0e0] outline-none focus:border-[#7de0a0]"
            />
            <div className="mt-1.5 flex gap-2">
              <button onClick={() => setDdpEdit(false)} className="rounded-xl px-3 py-2 text-[12px] font-bold text-[#5a7a68]">
                やめる
              </button>
              <button
                onClick={saveDdp}
                disabled={ddpSaving}
                className="flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold text-[#0a1410] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#a0e8b8,#7de0a0)" }}
              >
                {ddpSaving ? "保存中..." : "DDPを掲げる"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              setDdpDraft(ddp);
              setDdpEdit(true);
            }}
            className="mt-2 w-full rounded-xl border border-[#2a4a3a] bg-[#0c1812] px-3 py-3.5 text-center"
          >
            {ddp ? (
              <span className="text-[16px] font-extrabold leading-relaxed text-[#d8f0e0]">{ddp}</span>
            ) : (
              <span className="text-[13px] text-[#5a7a68]">タップしてDDP（短い夢）を掲げる</span>
            )}
          </button>
        )}
      </section>

      {/* ④ ニューラ活動 */}
      <section className="card" style={{ background: "linear-gradient(150deg,#101a28,#1a1a30)", border: "none" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-extrabold tracking-[2px]" style={{ color: "#a8b8f0", textShadow: "0 0 10px rgba(140,160,255,.6)" }}>
            🧠 ニューラ活動
          </span>
          <span className="text-[10px] text-[#5a6a8a]">冬至まで・5人1チーム</span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8a9ab8]">
          同じ町の5人でチームを組み、冬至までに<b className="text-[#c8d4f8]">他の4人のDDPを叶えてあげる</b>活動。
          あなたの役割は、自分のDDPを明確に持つこと。あなたの夢は、他の4人が叶えてくれる。
        </p>

        {team === undefined ? (
          <p className="py-3 text-[12px] text-[#5a6a8a]">読み込み中...</p>
        ) : team === null ? (
          me ? (
            <button
              onClick={join}
              disabled={joining || !myPref}
              className="mt-3 w-full rounded-xl py-3 text-[14px] font-extrabold text-[#101a28] disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}
            >
              {joining
                ? "チームを探しています..."
                : `🧠 ${myCity ?? myPref}のチームに参加する`}
            </button>
          ) : (
            <p className="mt-3 text-[12px] text-[#5a6a8a]">ログインすると参加できます</p>
          )
        ) : (
          <div className="mt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12.5px] font-extrabold text-[#c8d4f8]">
                🧠 ニューラ班（{team.city ?? team.prefecture}）
              </span>
              <span className="num text-[10px] text-[#5a6a8a]">
                {team.members.length}/{NEURA_SIZE}人 ・ {team.season}
              </span>
            </div>
            <div className="space-y-1.5">
              {team.members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-2.5 py-2">
                  {m.profiles?.avatar_url ? (
                    <img src={m.profiles.avatar_url} alt="" referrerPolicy="no-referrer" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#2a3a55] text-[15px]">🧠</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-bold text-[#c8d4f8]">
                      {m.profiles?.display_name ?? "メンバー"}
                      {m.user_id === me?.id && <span className="ml-1 text-[9px] text-[#8a9ab8]">（あなた）</span>}
                    </div>
                    <div className="truncate text-[12.5px] text-[#e8ecff]">
                      {m.ddp ? `🌊 ${m.ddp}` : <span className="text-[#4a5a78]">DDP未設定</span>}
                    </div>
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, NEURA_SIZE - team.members.length) }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-xl border border-dashed border-[#2a3a55] px-2.5 py-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-[13px] text-[#4a5a78]">＋</span>
                  <span className="text-[11.5px] text-[#4a5a78]">同じ町の仲間を待っています</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <Link
                href={`/line/g/neura/${team.id}`}
                className="flex-1 rounded-xl py-2.5 text-center text-[13px] font-extrabold text-[#101a28] no-underline"
                style={{ background: "linear-gradient(135deg,#b8c8ff,#8a9af0)" }}
              >
                💬 班のグループLINE
              </Link>
              <button
                onClick={async () => {
                  if (!me || !team) return;
                  if (!confirm("この班を抜けますか？")) return;
                  await leaveNeura(me.id, team.id);
                  setTeam(await myNeuraTeam(me.id));
                }}
                className="flex-shrink-0 rounded-xl border border-white/15 px-3 py-2.5 text-[11px] text-[#5a6a8a]"
              >
                抜ける
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ③ Cotozute */}
      <div className="px-4">
        <CotozuteFeed />
      </div>
    </main>
  );
}
