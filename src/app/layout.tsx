import { VersionGuard } from "@/components/VersionGuard";
import { IosBackButton } from "@/components/IosBackButton";
import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { PullToReload } from "@/components/PullToReload";
import SwipeNav from "@/components/SwipeNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneSea — 海は7つに分かれていない。OneSea",
  description:
    "太陽と月と潮のリズムで生きる、無料の手帳アプリ。360の節分かれつ刻と、四つの扉（セカイムラ・MMM・楽市楽座・ツキヨガ）。",
  metadataBase: new URL("https://onesea.vercel.app"),
  openGraph: {
    title: "OneSea — 海は7つに分かれていない。OneSea",
    description: "太陽と月と潮のリズムで生きる、無料の手帳アプリ。",
    url: "https://onesea.vercel.app",
    siteName: "OneSea",
    images: ["/icon-512.png"],
    type: "website",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
  // ホーム画面から起動したとき、Safariのアドレスバーを出さず全画面にする
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OneSea",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1e2e",
  width: "device-width",
  initialScale: 1,
  // iOS: 入力欄タップ時の自動ズームで固定バーがずれるのを防ぐ
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <VersionGuard />
        <IosBackButton />
        <div className="mx-auto min-h-screen max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] bg-washi pb-14">
          <PullToReload />
          <SwipeNav />
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
