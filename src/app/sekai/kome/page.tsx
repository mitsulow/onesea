"use client";

import { SekaiShell, KomeSection, useSekaiMe } from "@/components/sekai/sections";

/** セカイムラ米部 */
export default function SekaiKomePage() {
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <KomeSection me={me} myPref={myPref} />
    </SekaiShell>
  );
}
