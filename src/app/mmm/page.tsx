"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Otohikari } from "@/components/Otohikari";
import { ServiceIntro } from "@/components/ServiceIntro";
import { MorningOpening } from "@/components/MorningOpening";
import { SchumannAudioPlayer } from "@/components/SchumannAudioPlayer";
import { CotozuteTeaser } from "@/components/CotozuteTeaser";
import { ThreeCol } from "@/components/SideRails";
import Link from "next/link";
import { AvatarMenu } from "@/components/AvatarMenu";
import TopTone from "@/components/TopTone";
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
      if (u) {
        // マイページで変えた写真を優先。端末キャッシュで即描画→裏で最新化
        import("@/lib/avatarCache").then(({ cachedAvatar, cacheAvatar }) => {
          const c = cachedAvatar(u.id);
          if (c) setAvatar(c);
          supabase.from("profiles").select("avatar_url").eq("id", u.id).maybeSingle().then(({ data }) => {
            if (data?.avatar_url) setAvatar(data.avatar_url);
            if (data) cacheAvatar(u.id, data.avatar_url ?? null);
          });
        });
      }
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
    <main style={{ background: "#070b0a", minHeight: "100dvh" }}>
      <TopTone color="#0a1410" />
      {/* 朝一: その日はじめてなら「今日の地球を、どう楽しむ？」→ 地球儀に着地 */}
      <MorningOpening />
      {/* ヒーロー（統一規格: 高さ52px・サービス名センター・アバター右） */}
      <header className="relative z-[60] flex h-[52px] items-center justify-center px-6" style={{ background: "#0a1410" }}>
        <div className="text-center">
          <div className="text-[17px] font-extrabold tracking-[3px]" style={GREEN_NEON}>
            MasterMindMembers
          </div>
          <div className="text-[8px] leading-tight tracking-[2px] text-[#5a8a6a]">夢とヒラメキの保管庫</div>
        </div>
        <MmmMenuButton />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <AvatarMenu ring="#7de0a0" />
        </span>
      </header>

      {/* ① OTOHIKARI MAP + ② シューマン音（地球儀は全幅の没入バンド） */}
      <div className="px-4">
        <ServiceIntro svc="mmm" />
        <Otohikari />
        <SchumannAudioPlayer />
      </div>

      {/* ③以降は Cotozute と同じ3カラム（全幅・中央・左右レール）。地球儀の下から切り替わる */}
      <ThreeCol dark bg="#070b0a" centerClassName="space-y-3 px-3 lg:px-0" showSuggestions={false}>
      <CotozuteTeaser />

      </ThreeCol>
    </main>
  );
}


/** MMMの左上☰ — 統一ルール: キャッチ → MMMトップ → 下タブのみ */
function MmmMenuButton() {
  const [open, setOpen] = useState(false);
  const MENU = [
    { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM トップ" },
    { href: "/mmm/kouryu", icon: "/icons/icon-keijiban.webp", label: "交流" },
    { href: "/mmm/neura", icon: "/icons/icon-neura-red.webp", label: "ニューラ5" },
    { href: "/schumann1/index.html", icon: "/icons/icon-schumann2.webp", label: "シューマン共振", ext: true },
    { href: "/mmm/ddp-app", icon: "/icons/icon-rashinban.webp", label: "夢叶えナビ" },
    { href: "/talk", icon: "/icons/icon-talk-green.webp", label: "TalK" },
  ];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="メニュー"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[22px] leading-none"
        style={{ color: "#7de0a0" }}
      >
        ☰
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[85] bg-black/35" onClick={() => setOpen(false)} />
          <div className="fixed left-0 top-0 z-[86] h-full w-[270px] overflow-y-auto bg-white shadow-2xl">
            <div className="px-5 pb-2 pt-5">
              <div className="text-[10px] tracking-[2px] text-[#7ab890]">夢とヒラメキの保管庫</div>
              <div className="text-[19px] font-extrabold" style={{ color: "#1e6a40" }}>MasterMindMembers</div>
            </div>
            {MENU.map((m) =>
              m.ext ? (
                <a
                  key={m.href}
                  href={m.href}
                  className="flex items-center gap-3 border-b border-[#eef4ef] px-5 py-3 text-[14px] font-medium text-[#1c1e21] no-underline"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  {m.label}
                </a>
              ) : (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 border-b border-[#eef4ef] px-5 py-3 text-[14px] no-underline ${
                    m.href === "/mmm" ? "bg-[#e8f6ec] font-bold text-[#1e6a40]" : "font-medium text-[#1c1e21]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.icon} alt="" className="h-[22px] w-[22px] object-contain" />
                  {m.label}
                </Link>
              )
            )}
          </div>
        </>
      )}
    </>
  );
}
