"use client";

import { SekaiShell, SectionTitle, MapLoader } from "@/components/sekai/sections";

/** セカイムラ地図 */
export default function SekaiMapPage() {
  return (
    <SekaiShell>
      <section className="card">
        <SectionTitle><img src="/icons/icon-japanmap.webp" alt="" style={{ width: 18, height: 18, display: "inline", verticalAlign: -3 }} /> セカイムラ地図 — 旅先でも家族を見つける</SectionTitle>
        <MapLoader />
      </section>
    </SekaiShell>
  );
}
