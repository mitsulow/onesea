"use client";

import { useMemo } from "react";
import Link from "next/link";
import { OtohikariGlobe } from "@/components/OtohikariGlobe";
import { simulateSpots } from "@/lib/simulateSpots";

/**
 * 特別ページ: もしも、わらわ〜25,000人が同じ日にシューマン音©を聴いたら。
 * 本番データは使わないシミュレーション。金の光=あなた(東京タワーで聴いた想定)。
 */
export default function Sim25000() {
  const spots = useMemo(() => simulateSpots(25000), []);
  const TOKYO_TOWER: [number, number] = [35.6586, 139.7454];

  return (
    <main style={{ minHeight: "100vh", background: "#04050c", color: "#cfe0ec", paddingBottom: 48 }}>
      <header style={{ padding: "26px 20px 6px", textAlign: "center" }}>
        <div style={{ fontSize: 12, letterSpacing: "0.3em", color: "#7d829a", marginBottom: 8 }}>SIMULATION</div>
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 5.5vw, 30px)", fontWeight: 800, letterSpacing: "0.08em", color: "#e8ff00", textShadow: "0 0 14px rgba(232,255,0,.5)" }}>
          もしも、25,000人が光ったら
        </h1>
        <p style={{ margin: "10px auto 0", maxWidth: 560, fontSize: 12.5, lineHeight: 1.9, color: "#8d93aa" }}>
          わらわ〜25,000人が、同じ日にシューマン音©を聴いた世界のシミュレーション。
          <br />
          <span style={{ color: "#ffd88a" }}>金の光</span>があなた（東京タワーで聴いた想定）。
          水色の光だまりは人の重なり — 東京は厚く、田舎の一粒もちゃんと見える。
        </p>
      </header>

      <div style={{ maxWidth: 820, margin: "10px auto 0" }}>
        <OtohikariGlobe spots={spots} mode="otohikari" connected={false} mySpot={TOKYO_TOWER} />
      </div>

      <div style={{ textAlign: "center", marginTop: 22 }}>
        <Link
          href="/mmm"
          style={{ display: "inline-block", padding: "10px 22px", borderRadius: 18, border: "1px solid rgba(255,255,255,.25)", background: "rgba(255,255,255,.07)", color: "#e8d5a0", fontSize: 13, fontWeight: 700, textDecoration: "none" }}
        >
          ◀ MMMへ戻る
        </Link>
      </div>
    </main>
  );
}
