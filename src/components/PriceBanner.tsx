"use client";

import { useState } from "react";

/**
 * 各サービス共通の料金バナー。
 * 「入会する」を押すと、単独課金ではなくOneSea会員キャンペーンへ誘導する。
 */
export function PriceBanner({
  service,
  price,
  color = "#c8a030",
}: {
  service: string;
  price: string;
  color?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 px-4 py-2"
        style={{ background: "rgba(0,0,0,.25)", borderBottom: `1px solid ${color}44` }}
      >
        <span className="text-[11.5px] font-bold text-white/85">
          {service} <span className="num ml-1 font-extrabold" style={{ color }}>{price}</span>
        </span>
        <button
          onClick={() => setOpen(true)}
          className="flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#1a1a24]"
          style={{ background: color }}
        >
          入会する
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: "rgba(10,14,20,0.6)", backdropFilter: "blur(3px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-[400px] rounded-2xl p-5 text-center shadow-2xl"
            style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)", border: "1px solid #d4b96a66" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="閉じる"
              className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[13px] font-bold text-[#7a9ab4]"
            >
              ✕
            </button>
            <div className="text-[24px]">🎁</div>
            <div className="mt-1 text-[15px] font-extrabold leading-relaxed text-[#f0e6c8]">
              2027年は特別キャンペーン中
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#a8c4d4]">
              OneSea会員（<b className="num text-[#f0e6c8]">年39,600円</b>）になると、
              <br />
              MMM・セカイムラ・ツキヨガ・楽市楽座
              <br />
              <span className="num">合計18万円分</span>のすべてのサービスが受けられます。
            </p>
            <div className="mx-auto mt-3 w-fit rounded-xl bg-white/5 px-4 py-2 text-left text-[11px] leading-relaxed text-[#8aa8c0]">
              <div>☀️ MMM <span className="num">39,600円</span>/年</div>
              <div>🌏 セカイムラ <span className="num">36,000円</span>/年</div>
              <div>🌙 ツキヨガ <span className="num">60,000円</span>/年</div>
              <div>⛩ 楽市楽座 <span className="num">48,000円</span>/年</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-[#17232e]"
              style={{ background: "linear-gradient(135deg,#f0dca0,#d4b96a)" }}
            >
              OneSea会員について（準備中）
            </button>
          </div>
        </div>
      )}
    </>
  );
}
