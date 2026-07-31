"use client";

import { SekaiShell, MeisterSection, useSekaiMe } from "@/components/sekai/sections";

/** 百姓マイスター（講座 + 100の技） */
export default function SekaiMeisterPage() {
  const { me } = useSekaiMe();
  return (
    <SekaiShell>
      <MeisterSection me={me} />
    </SekaiShell>
  );
}
