"use client";

/**
 * 購入フロー — BASE等の決済サイトは iframe 埋め込みを禁止しているため(真っ白になる)、
 * 「購入はこちら」を押した瞬間に別タブでショップを開き、
 * OneSea側には前面パネルで「購入した場合は、出品者にTalKで連絡をお願いします」を出しておく。
 * 買い物から戻ってきた時に、そのままTalKで連絡できる。
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
  onTalk?: () => void;
}) {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 px-6">
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 text-center">
        <div className="text-[32px]">🛒</div>
        <h2 className="mt-1 text-[15px] font-extrabold text-[#3a3428]">購入ページを別タブで開きました</h2>
        <p className="mt-0.5 text-[10.5px] text-[#a09888]">{host}</p>
        <p className="mt-2.5 rounded-xl bg-[#fdf6e4] px-3 py-2.5 text-[13px] font-extrabold leading-relaxed text-[#8a6a20]">
          購入した場合は、出品者{sellerName ? `（${sellerName}さん）` : ""}に
          <br />TalKで連絡をお願いします🙏
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-full rounded-xl border-2 py-2.5 text-[13px] font-extrabold no-underline"
          style={{ borderColor: "#c94d3a", color: "#c94d3a" }}
        >
          もう一度 購入ページを開く ↗
        </a>
        {onTalk && (
          <button
            onClick={() => { onClose(); onTalk(); }}
            className="mt-2 w-full rounded-xl py-2.5 text-[13px] font-extrabold text-white"
            style={{ background: "#2a8a4a" }}
          >
            💬 TalKで出品者に連絡する
          </button>
        )}
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl border border-[#e0d8c8] py-2.5 text-[13px] font-bold text-[#6a5f4e]"
        >
          わかった（閉じる）
        </button>
      </div>
    </div>
  );
}
