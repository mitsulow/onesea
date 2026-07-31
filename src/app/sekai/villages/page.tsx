"use client";

import { useRouter } from "next/navigation";
import { SekaiShell, VillagesSection, useSekaiMe } from "@/components/sekai/sections";

/** 拠点（村）一覧・村をつくる */
export default function SekaiVillagesPage() {
  const router = useRouter();
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <VillagesSection me={me} myPref={myPref} router={router} />
    </SekaiShell>
  );
}
