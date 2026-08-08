"use client";

import { useEffect, useState } from "react";

/**
 * iPhoneのPWA(ホーム画面起動)にはAndroidのような「戻る」が無い。
 * その環境の時だけ、左下(タブバーの上)に小さな←ボタンを浮かせる。
 * Android・普通のブラウザでは出ない(それぞれ戻る手段があるので邪魔しない)。
 */
export function IosBackButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        // 旧iOS Safariの独自プロパティ
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      setShow(standalone && ios);
    } catch {}
  }, []);

  if (!show) return null;
  return (
    <button
      onClick={() => history.back()}
      aria-label="前のページへ戻る"
      className="fixed left-2 z-[90] flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-bold text-white"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 66px)",
        background: "rgba(20,24,32,.62)",
        backdropFilter: "blur(4px)",
        boxShadow: "0 2px 10px rgba(0,0,0,.3)",
      }}
    >
      ←
    </button>
  );
}
