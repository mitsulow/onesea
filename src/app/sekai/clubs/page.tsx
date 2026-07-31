"use client";

import { SekaiShell, ClubsSection, JinjaSection, useSekaiMe } from "@/components/sekai/sections";

/** セカイムラ部活情報（+ 神社町） */
export default function SekaiClubsPage() {
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <ClubsSection me={me} />
      <JinjaSection me={me} myPref={myPref} />
    </SekaiShell>
  );
}
