"use client";

import { useEffect, useState } from "react";
import { OtohikariGlobe, type MapMode } from "@/components/OtohikariGlobe";
import type { Spot } from "@/components/Otohikari";

/**
 * 地球儀だけを描く隔離フレーム。MMMトップから <iframe> で読み込む。
 * ねらい: 地球儀(WebGL)を、にぎやかなMMMページ本体とは別のドキュメントに分離し、
 * iOS Safariの「重いWebGLの上に動く半透明DOMを合成する」負荷から解放してサクサク回す。
 * spots / mode / connected は親から postMessage で受け取る(見た目・機能は一切変えない)。
 */
export default function OtohikariFramePage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [mode, setMode] = useState<MapMode>("all");
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.__oto !== 1) return;
      if (Array.isArray(d.spots)) setSpots(d.spots as Spot[]);
      if (d.mode === "otohikari" || d.mode === "thunder" || d.mode === "all") setMode(d.mode);
      if (typeof d.connected === "boolean") setConnected(d.connected);
    };
    window.addEventListener("message", onMsg);
    // 準備完了を親へ知らせる(親は最新状態を送り直す)
    try {
      window.parent?.postMessage({ __otoReady: 1 }, window.location.origin);
    } catch {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  return <OtohikariGlobe spots={spots} mode={mode} connected={connected} />;
}
