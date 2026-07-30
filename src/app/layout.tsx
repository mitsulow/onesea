import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/BottomNav";
import { PullToReload } from "@/components/PullToReload";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onesea — すべての海は、ひとつ。",
  description:
    "太陽と月と潮のリズムで生きる、無料の手帳アプリ。360の節分かれつ刻と、四つの扉（セカイムラ・MMM・楽市楽座・ツキヨガ）。",
  metadataBase: new URL("https://onesea.vercel.app"),
  openGraph: {
    title: "Onesea — すべての海は、ひとつ。",
    description: "太陽と月と潮のリズムで生きる、無料の手帳アプリ。",
    url: "https://onesea.vercel.app",
    siteName: "Onesea",
    images: ["/icon-512.png"],
    type: "website",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0e1e2e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        <div className="mx-auto min-h-screen max-w-[480px] bg-washi pb-14">
          <PullToReload />
          {children}
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
