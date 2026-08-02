import { InoriTecho } from "@/components/InoriTecho";
import { AuthGate } from "@/components/AuthGate";
import { HeaderBar } from "@/components/HeaderBar";
import { HomeDashboard, ServiceDock } from "@/components/HomeDashboard";
import { MorningOpening } from "@/components/MorningOpening";
import { A2hsPrompt } from "@/components/A2hsPrompt";
import { MoonMootBanner } from "@/components/MoonMootBanner";

/**
 * OneSeaトップ = 「ホーム中のホーム」。朝一で開いて今日が全部わかるページ。
 * 日付・願い叶いタイム・今日のダイジェスト → カレンダー → 9つのメインメニュー（星座盤）。
 * OTOHIKARI/シューマン音はMMM、CotozuteはコトヅテページにあるのでトップからはRemove。
 */
export default function Home() {
  return (
    <AuthGate>
      <MorningOpening />
      <A2hsPrompt />
      <main>
        <HeaderBar />
        <ServiceDock />
        <div className="px-4">
          <MoonMootBanner />
          <HomeDashboard />
          <div id="techo" style={{ scrollMarginTop: 40 }}>
            <InoriTecho />
          </div>
        </div>
      </main>
    </AuthGate>
  );
}
