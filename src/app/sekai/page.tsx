"use client";

import { useRouter } from "next/navigation";
import { SekaiShell, MootsSection, ActivitySection, WelcomeSection, useSekaiMe } from "@/components/sekai/sections";

/** セカイムラ トップ — 集い（満月会/新月会）+ 各地の活動報告 + 村人 */
export default function SekaiTopPage() {
  const router = useRouter();
  const { me, myPref, mootCount, refreshMootCount } = useSekaiMe();
  return (
    <SekaiShell>
      <MootsSection me={me} myPref={myPref} mootCount={mootCount} onRsvped={refreshMootCount} />
      <ActivitySection me={me} router={router} />
      <WelcomeSection me={me} router={router} />
    </SekaiShell>
  );
}
