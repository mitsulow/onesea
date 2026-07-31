"use client";

import { useRouter } from "next/navigation";
import { SekaiShell, LoungeSection, useSekaiMe } from "@/components/sekai/sections";

/** 地域ラウンジ + ラウンジ喫茶 */
export default function SekaiLoungePage() {
  const router = useRouter();
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <LoungeSection me={me} myPref={myPref} router={router} />
    </SekaiShell>
  );
}
