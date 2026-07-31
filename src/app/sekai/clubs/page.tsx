"use client";

import { SekaiShell, ClubsSection, useSekaiMe } from "@/components/sekai/sections";

/** 部活動 */
export default function SekaiClubsPage() {
  const { me } = useSekaiMe();
  return (
    <SekaiShell>
      <ClubsSection me={me} />
    </SekaiShell>
  );
}
