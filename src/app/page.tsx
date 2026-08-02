import { Otohikari } from "@/components/Otohikari";
import { SchumannAudioPlayer } from "@/components/SchumannAudioPlayer";
import { InoriTecho } from "@/components/InoriTecho";
import { CotozuteTeaser } from "@/components/CotozuteTeaser";
import { AuthGate } from "@/components/AuthGate";
import { HeaderBar } from "@/components/HeaderBar";
import { MorningOpening } from "@/components/MorningOpening";
import { A2hsPrompt } from "@/components/A2hsPrompt";
import { MoonMootBanner } from "@/components/MoonMootBanner";


export default function Home() {
  return (
    <AuthGate>
      <MorningOpening />
      <A2hsPrompt />
      <main className="pb-10">
        <HeaderBar />

        <div className="space-y-3.5 px-4 pb-2">
        {/* ⓪ セカイムラ満月会 / 新月会 */}
        <MoonMootBanner />

        {/* ① 祈りの手帳（OneSeaの主役。地球儀はMMMのホームが本籍） */}
        <div id="techo" style={{ scrollMarginTop: 40 }}>
          <InoriTecho />
        </div>

        {/* ② MasterMindSystem = 地球儀 + シューマン音プレイヤー（一体化） */}
        <div>
          <Otohikari />
          <SchumannAudioPlayer />
        </div>

        {/* ③ Cotozute */}
        <CotozuteTeaser />

        </div>
      </main>
    </AuthGate>
  );
}
