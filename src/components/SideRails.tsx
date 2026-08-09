"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { srcCdn } from "@/lib/images";
import { VillagerSuggestions } from "@/components/VillagerSuggestions";

/* eslint-disable @next/next/no-img-element */

const NAV: Array<{ href: string; icon: string; label: string; ext?: boolean }> = [
  { href: "/", icon: "/icons/tab-home.png", label: "ホーム" },
  { href: "/mmm", icon: "/icons/cel-sun.png", label: "MMM" },
  { href: "/sekai", icon: "/icons/cel-earth.png", label: "セカイムラ" },
  { href: "/tsukiyoga-v7/index.html", icon: "/icons/cel-moon.png", label: "ツキヨガ", ext: true },
  { href: "/cotozute", icon: "/icons/tab-cotozute3.webp", label: "コトヅテ" },
  { href: "/za", icon: "/icons/icon-za-mark.svg", label: "楽市楽座" },
  { href: "/#techo", icon: "/icons/icon-techo.webp", label: "手帳", ext: true },
  { href: "/my", icon: "/icons/icon-profile.webp", label: "マイページ" },
  { href: "/talk", icon: "💬", label: "TalK" },
];

interface RailStyle {
  card: string; // カードのclass（bg/border）
  text: string; // 主要文字色
  sub: string; // 補助文字色
  hover: string; // ホバー背景class
}
const LIGHT: RailStyle = { card: "border border-[#e4e6e9] bg-white", text: "text-[#1c1e21]", sub: "text-[#65676b]", hover: "hover:bg-[#f2f3f5]" };
const DARK: RailStyle = { card: "border border-white/10 bg-white/5", text: "text-[#e6f4ee]", sub: "text-[#8fb2a4]", hover: "hover:bg-white/10" };

export function ServiceNavRail({ dark = false }: { dark?: boolean }) {
  const s = dark ? DARK : LIGHT;
  return (
    <div className={"sticky top-16 rounded-xl p-2 " + s.card}>
      {NAV.map((m) => {
        const cls = `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium no-underline ${s.text} ${s.hover}`;
        const icon = m.icon.startsWith("/") ? (
          <img src={srcCdn(m.icon)} alt="" className="h-[22px] w-[22px] object-contain" />
        ) : (
          <span className="w-[22px] text-center text-[17px]">{m.icon}</span>
        );
        return m.ext ? (
          <a key={m.href} href={m.href} className={cls}>{icon}{m.label}</a>
        ) : (
          <Link key={m.href} href={m.href} className={cls}>{icon}{m.label}</Link>
        );
      })}
    </div>
  );
}

export function TodayEarthCard({ dark = false }: { dark?: boolean }) {
  const s = dark ? DARK : LIGHT;
  const [hz, setHz] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/sr/schumann_data.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setHz(d?.modes?.F1?.hz ?? null))
      .catch(() => {});
  }, []);
  const n = new Date();
  const label = `${n.getMonth() + 1}月${n.getDate()}日（${"日月火水木金土"[n.getDay()]}）`;
  const SYN = 29.530588853;
  const BASE = Date.UTC(2000, 0, 6, 18, 14);
  let age = ((Date.now() - BASE) / 86400000) % SYN;
  if (age < 0) age += SYN;
  return (
    <div className={"overflow-hidden rounded-xl p-4 " + s.card}>
      <div className={"text-[12px] font-bold " + s.sub}><img src="/icons/cel-earth.png" alt="" style={{ width: 14, height: 14, display: "inline", verticalAlign: -2.5 }} /> 今日の地球</div>
      <div className={"num mt-2 text-[15px] font-extrabold " + s.text}>{label}</div>
      <div className={"mt-1.5 text-[12px] " + s.sub}>
        月齢 <b className={"num " + s.text}>{age.toFixed(1)}</b>
        <span className="mx-1.5 opacity-40">・</span>
        シューマン共振 <b className="num text-[#2CB7DE]">{hz ? hz.toFixed(2) : "—"}</b> Hz
      </div>
      <Link href="/mmm" className="mt-2.5 inline-block text-[12px] font-bold text-[#2CB7DE] no-underline">
        いまの地球の音を聴く →
      </Link>
    </div>
  );
}

/**
 * Facebook/Instagram型の3カラム。全幅に広げ、中央は細いまま、両脇にレール。
 * lg未満は中央1カラムのみ。dark=暗いテーマ（MMM等）でレールも暗色に。
 */
export function ThreeCol({
  children,
  bg = "#f0f2f5",
  centerClassName = "",
  rightExtra,
  showSuggestions = true,
  dark = false,
}: {
  children: React.ReactNode;
  bg?: string;
  centerClassName?: string;
  rightExtra?: React.ReactNode;
  showSuggestions?: boolean;
  dark?: boolean;
}) {
  const s = dark ? DARK : LIGHT;
  return (
    <div style={{ background: bg, width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
      <div className="mx-auto flex w-full max-w-[1180px] justify-center gap-5 lg:px-4">
        <aside className="hidden w-[240px] shrink-0 pt-4 lg:block">
          <ServiceNavRail dark={dark} />
        </aside>
        <div className={"w-full max-w-[600px] " + centerClassName} style={{ minWidth: 0 }}>
          {children}
        </div>
        <aside className="hidden w-[300px] shrink-0 pt-4 lg:block">
          <div className="sticky top-16 space-y-3">
            <TodayEarthCard dark={dark} />
            {rightExtra}
            {showSuggestions && (
              <div className={"rounded-xl p-3 " + s.card}>
                <VillagerSuggestions title="おすすめのむらびと" variant="list" />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
