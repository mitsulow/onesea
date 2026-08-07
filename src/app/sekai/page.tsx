"use client";

import { useRouter } from "next/navigation";
import {
  SekaiShell,
  MootsSection,
  ActivitySection,
  WelcomeSection,
  CafeBar,
  SectionTitle,
  MapLoader,
  useSekaiMe,
} from "@/components/sekai/sections";

/** セカイムラホーム — 新月会/満月会・活動報告・村人・喫茶・地図 */
export default function SekaiHomePage() {
  const router = useRouter();
  const { me, myPref, mootCount, refreshMootCount } = useSekaiMe();
  return (
    <SekaiShell>
      <MootsSection me={me} myPref={myPref} mootCount={mootCount} onRsvped={refreshMootCount} />
      <ActivitySection me={me} />
      <CafeBar pref={myPref} />
      <WelcomeSection me={me} myPref={myPref} router={router} />
    </SekaiShell>
  );
}
