import { InoriTecho } from "@/components/InoriTecho";
import { AuthGate } from "@/components/AuthGate";
import { HeaderBar } from "@/components/HeaderBar";
import { HomeDashboard, ServiceDock } from "@/components/HomeDashboard";
import { MorningRedirect } from "@/components/MorningRedirect";
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
      <MorningRedirect />
      <A2hsPrompt />
      {/* 黒い机の上に、紙の手帳と光る計器を置く構成。
          題字と今日 → 手帳（紙のカード） → オービット → ヒーローは一番下 */}
      <main style={{ background: "#0e1116", minHeight: "100dvh" }}>
        <div className="px-4">
          <HomeDashboard />
          <MoonMootBanner />
          <div
            id="techo"
            className="overflow-hidden rounded-2xl"
            style={{ scrollMarginTop: 40, boxShadow: "0 10px 44px rgba(0,0,0,.55)" }}
          >
            <InoriTecho />
          </div>
        </div>
        <div className="mt-2">
          <ServiceDock />
        </div>
        <HeaderBar />
        <div style={{ height: 28 }} />
      </main>
    </AuthGate>
  );
}
