"use client";

import { useState } from "react";

/**
 * 購入オーバーレイ — OneSeaの画面の上に、出品者のショップ(BASE・PayPay等)を重ねて表示。
 * 手帳の「地図」オーバーレイと同じ流儀。右端に縦スクロールバーが出て、その場で決済までできる。
 * ×で閉じる時に「購入した場合は、出品者にTalKで連絡をお願いします」のダイアログを出してから閉じる。
 * ※一部の決済サイトは埋め込みを禁止しているため、「別タブで開く」も用意した二段構え。
 */
export function PayOverlay({
  url,
  sellerName,
  onClose,
  onTalk,
}: {
  url: string;
  sellerName?: string | null;
  onClose: () => void;
  onTalk?: () => void; // TalKで出品者に連絡(あれば閉じダイアログにボタンを出す)
}) {
  const [closing, setClosing] = useState(false);
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 px-3 py-6">
      <div className="flex h-full w-full max-w-[480px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-[#f0ece2] px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-extrabold text-[#3a3428]">🛒 購入ページ</div>
            <div className="truncate text-[10px] text-[#a09888]">{host}</div>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-full border border-[#e0d8c8] px-2.5 py-1 text-[10.5px] font-bold text-[#8a7a5a] no-underline"
          >
            別タブで開く ↗
          </a>
          <button
            onClick={() => setClosing(true)}
            aria-label="とじる"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece2] text-[15px] font-bold text-[#6a5f4e]"
          >
            ×
          </button>
        </div>

        {/* ショップ本体(右にスクロールバー) */}
        <div className="min-h-0 flex-1" style={{ overflow: "hidden" }}>
          <iframe
            src={url}
            title="購入ページ"
            className="h-full w-full"
            style={{ border: 0, overflowY: "scroll" }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <p className="flex-shrink-0 border-t border-[#f0ece2] px-3 py-1.5 text-center text-[9.5px] leading-relaxed text-[#b0a890]">
          画面が真っ白な場合は、このサイトが埋め込み表示を許可していません。右上の「別タブで開く」からどうぞ
        </p>
      </div>

      {/* 閉じる前のご案内 */}
      {closing && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 px-6">
          <div className="w-full max-w-[330px] rounded-2xl bg-white p-5 text-center">
            <div className="text-[30px]">🙏</div>
            <p className="mt-2 text-[13.5px] font-extrabold leading-relaxed text-[#3a3428]">
              購入した場合は、出品者{sellerName ? `（${sellerName}さん）` : ""}に
              <br />TalKで連絡をお願いします
            </p>
            {onTalk && (
              <button
                onClick={() => { setClosing(false); onClose(); onTalk(); }}
                className="mt-3 w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white"
                style={{ background: "#2a8a4a" }}
              >
                💬 TalKで出品者に連絡する
              </button>
            )}
            <button
              onClick={() => { setClosing(false); onClose(); }}
              className="mt-2 w-full rounded-xl border border-[#e0d8c8] py-2.5 text-[13px] font-bold text-[#6a5f4e]"
            >
              わかった（閉じる）
            </button>
            <button onClick={() => setClosing(false)} className="mt-1.5 w-full py-1.5 text-[11px] font-bold text-[#b0a890]">
              まだ買い物をつづける
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
