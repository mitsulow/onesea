"use client";

import { useState } from "react";

/** 楽市楽座のマーク・ことばの意味をまとめた説明ダイアログ */
const ITEMS: Array<{ mark: string; title: string; desc: string }> = [
  { mark: "🔰", title: "初心者応援！", desc: "「これが初挑戦」の出品です。はじめて作ったもの・はじめてのサービスに、みんなで応援の気持ちを。" },
  { mark: "【お試し版】", title: "お試し版", desc: "本番の一部を無料や少量で試せる出品です。例: 60分マッサージのうち10分だけ無料でお試し。" },
  { mark: "⇄", title: "ブツブツ交換", desc: "お金ではなく「物と物」「物とサービス」で交換する提案ができます。提案が届いたら出品者が相手を決めます。" },
  { mark: "🌱", title: "0円でゆずる", desc: "無料でおゆずりする出品です（楽市）。数量がある場合は「何人にゆずれる」枠が決まっています。" },
  { mark: "SOLD OUT", title: "売買成立", desc: "交換・売買が成立した出品です。写真が白黒になり、新しい提案はできません。" },
  { mark: "決", title: "決定ハンコ", desc: "ブツブツ交換で「この人に決めた」しるし。選ばれなかった提案は薄く残ります。" },
  { mark: "🛒", title: "購入はこちら", desc: "出品者のBASE・PayPayなどの購入ページが開きます。購入後はTalKで出品者にひとこと連絡を。" },
  { mark: "💻", title: "ネット上で交換", desc: "占い・相談・データ納品など、郵送や手渡しのいらないサービスの交換方法です。" },
];

export function ZaLegendButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "mx-auto mb-2 block rounded-full border border-[#e0d6c6] bg-white px-3 py-1.5 text-[11px] font-bold text-[#8a7a5a]"}
      >
        ❓ マークやことばの意味
      </button>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/55 px-5" onClick={() => setOpen(false)}>
          <div className="max-h-[80dvh] w-full max-w-[400px] overflow-y-auto rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-[14.5px] font-extrabold text-[#3a3428]">❓ 楽市楽座のマークの意味</div>
            <div className="space-y-2.5">
              {ITEMS.map((it) => (
                <div key={it.title} className="flex items-start gap-2.5 rounded-xl bg-[#faf7f0] px-3 py-2.5">
                  <span className="flex-shrink-0 text-[16px] font-extrabold" style={{ color: "#c94d3a", minWidth: 30 }}>{it.mark}</span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-extrabold text-[#3a3428]">{it.title}</div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#8a8070]">{it.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setOpen(false)} className="mt-3 w-full rounded-xl border border-[#e0d8c8] py-2.5 text-[13px] font-bold text-[#6a5f4e]">とじる</button>
          </div>
        </div>
      )}
    </>
  );
}
