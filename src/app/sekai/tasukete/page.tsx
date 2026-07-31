"use client";

import { useRouter } from "next/navigation";
import { SekaiShell, TasuketeSection, useSekaiMe } from "@/components/sekai/sections";

/** 助けて掲示板 */
export default function SekaiTasuketePage() {
  const router = useRouter();
  const { me, myPref } = useSekaiMe();
  return (
    <SekaiShell>
      <TasuketeSection me={me} myPref={myPref} router={router} />
    </SekaiShell>
  );
}
