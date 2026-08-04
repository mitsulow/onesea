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
      {/* 白基調。題字だけ黒帯 → 日付・計器・予定・カレンダー（全幅白）
          → 一番下に黒ブロック（オービット + 無料アプリOneSea/Googleアイコン） */}
      <main className="bg-white" style={{ minHeight: "100dvh", marginBottom: -56 }}>
        <div className="px-4">
          <HomeDashboard />
          <MoonMootBanner />
          <div id="techo" style={{ scrollMarginTop: 40 }}>
            <InoriTecho />
          </div>
        </div>
        <div style={{ background: "#0e1116" }}>
          <ServiceDock />
          <HeaderBar />
        </div>
      </main>
    </AuthGate>
  );
}
