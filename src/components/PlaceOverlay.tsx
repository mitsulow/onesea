"use client";

/**
 * 場所の詳細オーバーレイ — OneSeaの画面の上にGoogleマップを重ねて表示。
 * ×を押すと元のOneSea画面に戻る(アプリの外へ飛ばない)。
 * 手帳のイベント・セカイムラのイベント詳細から使う。
 * ※Google検索ページ本体はiframe埋め込みを禁止しているため、
 *   埋め込み可能なGoogleマップ(output=embed)+「Googleでもっと詳しく」リンクの二段構え。
 */

export interface PlaceInfo {
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  url?: string | null; // 元の共有リンク(あればこちらを開く)
}

export function PlaceOverlay({ place, onClose }: { place: PlaceInfo; onClose: () => void }) {
  // 座標があれば座標だけで指す(名前を混ぜると構文が壊れて無関係な場所に飛ぶことがある)
  const q = place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : (place.name ?? "");
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&hl=ja&output=embed`;
  const openUrl =
    place.url ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      place.lat != null && place.lng != null ? `${place.lat},${place.lng}` : (place.name ?? "")
    )}`;
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/55 px-4" onClick={onClose}>
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0 truncate text-[14px] font-extrabold text-[#3a3428]">
            📍 {place.name || "場所の詳細"}
          </div>
          <button
            onClick={onClose}
            aria-label="とじる"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#f0ece2] text-[15px] font-bold text-[#6a5f4e]"
          >
            ×
          </button>
        </div>
        <iframe
          src={embed}
          title="地図"
          className="h-[46vh] w-full border-0 bg-[#eef2ee]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <a
          href={openUrl}
          target="_blank"
          rel="noopener"
          className="block bg-[#fffaf0] px-4 py-3 text-center text-[13px] font-extrabold no-underline"
          style={{ color: "#3070b0", borderTop: "1px solid #f0e8d8" }}
        >
          Googleでもっと詳しく見る →
        </a>
      </div>
    </div>
  );
}
