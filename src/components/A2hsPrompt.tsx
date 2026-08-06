"use client";

import { useEffect, useState } from "react";

/**
 * ホーム画面に追加（A2HS）の誘導。
 * - Android Chrome 系: beforeinstallprompt を捕まえてワンタップで公式ダイアログを出す
 * - iPhone (Safari): APIが無いので手順を図解表示
 * - その他: メニューからの追加手順を表示
 * すでにホーム画面から起動している場合は出さない。「あとで」は7日間非表示。
 */

const KEY = "onesea-a2hs-dismissed";

interface BipEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function A2hsPrompt() {
  const [mode, setMode] = useState<null | "native" | "ios" | "generic">(null);
  const [bip, setBip] = useState<BipEvent | null>(null);

  useEffect(() => {
    try {
      const nav = navigator as Navigator & { standalone?: boolean };
      const installed =
        window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      if (installed) return;
      const dismissed = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() - dismissed < 7 * 86400000) return;

      const ua = navigator.userAgent;
      const isIos =
        /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);

      const onBip = (e: Event) => {
        e.preventDefault();
        setBip(e as BipEvent);
        setMode("native");
      };
      window.addEventListener("beforeinstallprompt", onBip);
      const t = setTimeout(() => {
        setMode((m) => m ?? (isIos ? "ios" : "generic"));
      }, 2500);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBip);
        clearTimeout(t);
      };
    } catch {}
  }, []);

  if (!mode) return null;

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
    setMode(null);
  };

  const install = async () => {
    if (!bip) return;
    try {
      await bip.prompt();
      const choice = await bip.userChoice;
      if (choice.outcome === "accepted") setMode(null);
    } catch {}
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[120] mx-auto max-w-[480px] md:max-w-[820px] lg:max-w-[1080px] px-3 pb-[70px]">
      <div
        className="rounded-2xl border p-4"
        style={{
          background: "linear-gradient(160deg,#0e1e2e,#17384e)",
          borderColor: "rgba(212,185,106,.5)",
          boxShadow: "0 -4px 30px rgba(0,0,0,.35)",
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-extrabold text-[#f0e6c8]">
              ホーム画面に追加してください
            </div>
            <div className="text-[10.5px] text-[#8aa8c0]">
              アプリのように開けて、未読の数字バッジも出ます
            </div>
          </div>
        </div>

        {mode === "native" ? (
          <button
            onClick={install}
            className="mt-3 w-full rounded-xl py-3 text-[14.5px] font-extrabold text-[#17232e]"
            style={{ background: "linear-gradient(135deg,#f0dca0,#d4b96a)" }}
          >
            ホーム画面に追加する
          </button>
        ) : mode === "ios" ? (
          <ol className="mt-3 space-y-1.5 text-[12.5px] leading-relaxed text-[#cfe0ea]">
            <li>
              ① 下の共有ボタン
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#7ab8d8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-1 inline-block align-[-2px]"
                aria-hidden
              >
                <path d="M12 3v12M8 7l4-4 4 4" />
                <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
              </svg>
              をタップ
            </li>
            <li>② 「ホーム画面に追加」を選ぶ</li>
            <li>③ 右上の「追加」を押す</li>
            <li className="pt-0.5 text-[10.5px] text-[#7a94a8]">
              ※ LINEなどのアプリ内で開いている場合は、まず右下の「…」から
              「Safariで開く」を押してからやってください
            </li>
          </ol>
        ) : (
          <div className="mt-3 text-[12.5px] leading-relaxed text-[#cfe0ea]">
            右上の「⋮」（または「…」）メニューを押して、
            <b className="text-[#f0e6c8]">「ホーム画面に追加」</b>
            （機種によっては「アプリをインストール」）を押してください。
          </div>
        )}

        <button onClick={later} className="mt-2.5 w-full py-1 text-center text-[11.5px] text-[#6a8498]">
          あとで
        </button>
      </div>
    </div>
  );
}
