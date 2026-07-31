"use client";

import { SekaiShell, SectionTitle, MapLoader } from "@/components/sekai/sections";

/** 村の地図 */
export default function SekaiMapPage() {
  return (
    <SekaiShell>
      <section className="card">
        <SectionTitle>🗾 村の地図 — 旅先でも家族を見つける</SectionTitle>
        <MapLoader />
      </section>
    </SekaiShell>
  );
}
