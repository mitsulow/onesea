"use client";

import { SekaiShell, SectionTitle, MapLoader } from "@/components/sekai/sections";

/** セカイムラ地図 */
export default function SekaiMapPage() {
  return (
    <SekaiShell>
      <section className="card">
        <SectionTitle>🗾 セカイムラ地図 — 旅先でも家族を見つける</SectionTitle>
        <MapLoader />
      </section>
    </SekaiShell>
  );
}
