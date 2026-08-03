"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 朝一の導線: その日はじめて開いたときは、オープニング（今日の地球を、どう楽しむ？）
 * が地球儀に着地するMMMへ連れて行く。2回目以降はOneSeaトップのまま。
 * 「その日」の判定は MorningOpening と同じ AM3:00 切り替え。
 * フラグはここでは立てない（MMM側のMorningOpeningが立てる）。
 */
export function MorningRedirect() {
  const router = useRouter();
  useEffect(() => {
    try {
      const today = new Date(Date.now() - 3 * 3600 * 1000);
      const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
      if (localStorage.getItem("onesea-morning-shown") !== key) {
        router.replace("/mmm");
      }
    } catch {}
  }, [router]);
  return null;
}
