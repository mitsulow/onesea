import { Otohikari } from "@/components/Otohikari";
import { SchumannAudioPlayer } from "@/components/SchumannAudioPlayer";
import { InoriTecho } from "@/components/InoriTecho";
import { CotozuteFeed } from "@/components/CotozuteFeed";
import { AuthGate } from "@/components/AuthGate";
import { HeaderBar } from "@/components/HeaderBar";
import { MorningOpening } from "@/components/MorningOpening";


export default function Home() {
  return (
    <AuthGate>
      <MorningOpening />
      <main className="pb-10">
        <HeaderBar />

        <div className="space-y-3.5 px-4 pb-2">
        {/* ① OTOHIKARI（本番: 実測周波数・リアルタイム人数） */}
        <Otohikari />

        {/* ②シューマン音©（令和八年夏至点）— 端末保存で再生 */}
        <SchumannAudioPlayer />

        {/* ② Cotozute */}
        <CotozuteFeed />

        {/* ③ 祈りの手帳 */}
        <div id="techo" style={{ scrollMarginTop: 40 }}>
          <InoriTecho />
        </div>

        </div>
      </main>
    </AuthGate>
  );
}
