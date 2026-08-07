"use client";

import { createClient } from "@/lib/supabase/client";

/** わらわ〜会員の入会案内（無料アプリからのグレードアップ先） */
export default function JoinPage() {
  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
  };

  const CAN = [
    ["🧘", "シューマン音・瞑想モードのフル再生", "実測シューマン共振で作る音響プログラム"],
    ["🖋", "CotoZuteへの投稿・ストーリーズ", "幸せの波紋を、みんなへ拡げる"],
    ["⛩", "楽市楽座への出品", "0円出品・物々交換もOK。日本人総フリーランス化計画"],
    ["🏡", "セカイムラの拠点・イベント参加", "全国の村人たちとつながる"],
    ["💬", "TalK（メッセージ）", "個人TALK・グループTALK"],
    ["🌙", "ツキヨガ・月の統計", "月齢と暮らすためのすべての道具"],
  ];

  return (
    <main
      className="min-h-dvh px-6 pb-16 pt-10 text-center"
      style={{ background: "linear-gradient(170deg,#0e1e2e 0%,#14324a 62%,#1e4a66 100%)" }}
    >
      <div className="text-[13px] tracking-[4px] text-[#9ab8cc]">無料アプリOneSea から</div>
      <h1 className="mt-1 text-[26px] font-extrabold tracking-[3px] text-[#f0e6c8]">わらわ〜会員へ</h1>
      <p className="mt-3 text-[13px] leading-loose text-[#b8ccda]">
        無料のままでも、手帳とシューマン共振はずっと使えます。<br />
        わらわ〜会員になると、見るだけだった海に、入れるようになります。
      </p>

      <div className="mx-auto mt-6 max-w-[360px] space-y-2 text-left">
        {CAN.map(([emoji, title, desc]) => (
          <div key={title} className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3">
            <span className="text-[20px]">{emoji}</span>
            <div>
              <div className="text-[13px] font-extrabold text-[#e8dcb8]">{title}</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-[#8aa8bc]">{desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-[360px] rounded-2xl border border-[#d4b96a]/40 bg-[#d4b96a]/10 px-4 py-4">
        <div className="text-[12px] text-[#c8b88a]">わらわ〜（年会費）</div>
        <div className="num mt-0.5 text-[26px] font-extrabold text-[#f0e6c8]">
          39,600<span className="text-[13px]">円 / 年</span>
        </div>
        <div className="mt-1 text-[10.5px] text-[#8aa8bc]">入会の受付方法は、近日このページでご案内します</div>
      </div>

      <button
        onClick={login}
        className="mx-auto mt-6 block w-full max-w-[300px] rounded-2xl bg-white py-3.5 text-[14px] font-extrabold text-[#3a3428]"
      >
        すでに会員の方は Googleでログイン
      </button>
      <a href="/" className="mt-5 inline-block text-[12px] text-[#5a7a92] no-underline">
        ← 無料アプリにもどる
      </a>
    </main>
  );
}
