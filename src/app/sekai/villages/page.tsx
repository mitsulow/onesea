"use client";

import { useRouter } from "next/navigation";
import { SekaiShell, VillagesSection, SeedSection, useSekaiMe } from "@/components/sekai/sections";

/** 拠点（村）一覧・村をつくる */
export default function SekaiVillagesPage() {
  const router = useRouter();
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <VillagesSection me={me} myPref={myPref} router={router} />
      {/* 村の立ち上げ（村の種）— 全国セカイムラ一覧と同じデータで同期 */}
      <SeedSection me={me} />
    </SekaiShell>
  );
}
