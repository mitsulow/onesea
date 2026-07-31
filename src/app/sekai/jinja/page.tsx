"use client";

import { SekaiShell, JinjaSection, useSekaiMe } from "@/components/sekai/sections";

/** セカイムラ神社町 */
export default function SekaiJinjaPage() {
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <JinjaSection me={me} myPref={myPref} />
    </SekaiShell>
  );
}
