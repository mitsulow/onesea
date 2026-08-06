import { WARAWA_LP_URL } from "@/lib/warawa";

/* eslint-disable @next/next/no-img-element */

/**
 * サービス別ランディングページの共通レンダラー。
 * 各サービス（ツキヨガ/セカイムラ/MMM/楽市楽座）は自分の価格を大きく見せつつ、
 * 入会ボタンは全て OneSea キャンペーン（模擬決済ページ）へ集約する。
 * ※後日デザイナーが精緻に作り直す前提の、フェーブル製の最善版プレースホルダ。
 */

export interface LPTheme {
  bg: string; // ページ全体の背景（グラデ）
  ink: string; // 基本テキスト
  sub: string; // 補助テキスト
  accent: string; // アクセント（見出し・線）
  accentSoft: string; // 淡いアクセント（枠・帯）
  ctaBg: string; // CTAボタン背景
  ctaInk: string; // CTAボタン文字
  heroOverlay: string; // ヒーロー画像の上に敷くグラデ
}

export interface LPFeature {
  no: string;
  title: string;
  body: string;
}

export interface LPInstructor {
  monogram: string;
  role: string;
  line: string;
}

export interface LPConfig {
  key: string;
  brandKicker: string; // 上部の小さいラベル（例: TSUKIYOGA）
  title: string; // 大見出し（例: ツキヨガ）
  tagline: string; // ヒーローの一文
  lead: string; // 導入文
  heroImg: string; // ヒーロー画像
  heroContain?: boolean; // 画像をcontainで見せる（ロゴ等）
  features: LPFeature[];
  featuresHeading: string;
  instructors?: LPInstructor[]; // ツキヨガ用
  instructorsHeading?: string;
  gallery?: { img: string; caption: string }[]; // 世界観の写真列
  galleryHeading?: string;
  priceMain: string; // 大きく出す価格（例: 5,500円 / 月）
  priceSub?: string; // 補足（例: 年 66,000円分）
  theme: LPThemeName;
}

export type LPThemeName = "tsukiyoga" | "sekai" | "mmm" | "za";

const THEMES: Record<LPThemeName, LPTheme> = {
  tsukiyoga: {
    bg: "linear-gradient(180deg,#0a0e1c 0%,#111634 40%,#0c1024 100%)",
    ink: "#eae6f2", sub: "#9aa0c4", accent: "#e8d5a0", accentSoft: "rgba(232,213,160,0.3)",
    ctaBg: "linear-gradient(120deg,#f0e6c8,#d4b96a)", ctaInk: "#1a1420",
    heroOverlay: "linear-gradient(180deg,rgba(10,14,28,0.15),rgba(10,14,28,0.85) 85%)",
  },
  sekai: {
    bg: "linear-gradient(180deg,#0f1a12 0%,#16301d 45%,#0e1a12 100%)",
    ink: "#e8f0e4", sub: "#9bb89f", accent: "#e6c98a", accentSoft: "rgba(120,190,140,0.3)",
    ctaBg: "linear-gradient(120deg,#e8cc90,#c8a860)", ctaInk: "#14231a",
    heroOverlay: "linear-gradient(180deg,rgba(15,26,18,0.2),rgba(15,26,18,0.88) 85%)",
  },
  mmm: {
    bg: "radial-gradient(120% 90% at 50% 0%,#0e2230 0%,#0a0f16 55%,#06090e 100%)",
    ink: "#e6f4ee", sub: "#88b0a0", accent: "#7de0a0", accentSoft: "rgba(110,230,150,0.3)",
    ctaBg: "linear-gradient(120deg,#7cf9d4,#35c9a5)", ctaInk: "#05201a",
    heroOverlay: "linear-gradient(180deg,rgba(6,9,14,0.1),rgba(6,9,14,0.88) 85%)",
  },
  za: {
    bg: "linear-gradient(180deg,#1a0e0a 0%,#2a140e 45%,#180c08 100%)",
    ink: "#f6ece0", sub: "#c9a78e", accent: "#f0c088", accentSoft: "rgba(201,77,58,0.35)",
    ctaBg: "linear-gradient(120deg,#f0dca0,#d4b96a)", ctaInk: "#2a140e",
    heroOverlay: "linear-gradient(180deg,rgba(26,14,10,0.15),rgba(26,14,10,0.86) 85%)",
  },
};

export function ServiceLP({ cfg }: { cfg: LPConfig }) {
  const t = THEMES[cfg.theme];

  return (
    <main style={{ background: t.bg, color: t.ink, minHeight: "100dvh" }}>
      {/* トップの細いバー */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${t.accentSoft}` }}>
        <span className="text-[12px] font-extrabold tracking-[3px]" style={{ color: t.accent }}>OneSea</span>
        <a href="/" className="text-[11px] no-underline" style={{ color: t.sub }}>無料アプリにもどる</a>
      </div>

      {/* ヒーロー */}
      <section className="relative mx-auto max-w-[860px]">
        <div className="relative flex min-h-[62vh] flex-col items-center justify-end overflow-hidden px-6 pb-10 pt-16 text-center">
          <img
            src={cfg.heroImg}
            alt=""
            className={"pointer-events-none absolute inset-0 h-full w-full " + (cfg.heroContain ? "object-contain p-10 opacity-40" : "object-cover")}
          />
          <div className="pointer-events-none absolute inset-0" style={{ background: t.heroOverlay }} />
          <div className="relative">
            <div className="text-[11px] font-bold tracking-[6px]" style={{ color: t.accent }}>{cfg.brandKicker}</div>
            <h1
              className="mt-3 text-[40px] font-extrabold leading-tight tracking-[4px]"
              style={{ fontFamily: '"Shippori Mincho","Yu Mincho",serif' }}
            >
              {cfg.title}
            </h1>
            <p className="mx-auto mt-4 max-w-[460px] text-[15px] leading-loose" style={{ color: t.ink, fontFamily: '"Shippori Mincho",serif' }}>
              {cfg.tagline}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[640px] px-6">
        <p className="mt-8 text-[14px] leading-loose" style={{ color: t.sub }}>{cfg.lead}</p>

        {/* 特徴 */}
        <h2 className="mt-12 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.featuresHeading}</h2>
        <div className="mt-4 space-y-3">
          {cfg.features.map((f) => (
            <div key={f.no} className="flex gap-4 rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${t.accentSoft}` }}>
              <span className="num text-[26px] font-extrabold leading-none" style={{ color: t.accent, opacity: 0.55 }}>{f.no}</span>
              <div>
                <div className="text-[14.5px] font-extrabold">{f.title}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed" style={{ color: t.sub }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 講師（ツキヨガ） */}
        {cfg.instructors && (
          <>
            <h2 className="mt-12 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.instructorsHeading}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {cfg.instructors.map((ins, i) => (
                <div key={i} className="rounded-2xl px-2 py-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${t.accentSoft}` }}>
                  <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[20px] font-extrabold"
                    style={{ border: `2px solid ${t.accent}`, color: t.accent, fontFamily: "serif" }}
                  >
                    {ins.monogram}
                  </div>
                  <div className="mt-2.5 text-[11.5px] font-extrabold">{ins.role}</div>
                  <div className="mt-1 text-[10px] leading-snug" style={{ color: t.sub }}>{ins.line}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[10.5px]" style={{ color: t.sub }}>※講師のお名前・お写真はまもなく公開します</p>
          </>
        )}

        {/* 世界観ギャラリー */}
        {cfg.gallery && (
          <>
            <h2 className="mt-12 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.galleryHeading}</h2>
            <div className="hide-scrollbar mt-4 flex gap-2.5 overflow-x-auto pb-1">
              {cfg.gallery.map((g, i) => (
                <div key={i} className="w-[210px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ border: `1px solid ${t.accentSoft}` }}>
                  <img src={g.img} alt="" className="h-[128px] w-full object-cover" />
                  <div className="px-3 py-2 text-[11px]" style={{ color: t.sub, background: "rgba(0,0,0,0.25)" }}>{g.caption}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 価格 + キャンペーン導線 */}
        <section className="mt-14 rounded-3xl px-6 py-8 text-center" style={{ background: "rgba(255,255,255,0.05)", border: `1.5px solid ${t.accent}` }}>
          <div className="text-[11px] font-bold tracking-[3px]" style={{ color: t.sub }}>{cfg.title} 単体プラン</div>
          <div className="num mt-2 text-[38px] font-extrabold leading-none" style={{ color: t.accent }}>{cfg.priceMain}</div>
          {cfg.priceSub && <div className="num mt-1.5 text-[12px]" style={{ color: t.sub }}>{cfg.priceSub}</div>}

          <div className="mx-auto mt-6 max-w-[420px] rounded-2xl px-4 py-3.5 text-left" style={{ background: "rgba(255,255,255,0.06)", border: `1px dashed ${t.accent}` }}>
            <div className="text-[12px] font-extrabold" style={{ color: t.accent }}>いま、OneSeaキャンペーン中</div>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: t.ink }}>
              {cfg.title}に加えて、<b>MMM・セカイムラ・楽市楽座</b>の全機能が、
              単体4つ分の総額 <span className="num">210,000円</span> のところ
              <b className="num" style={{ color: t.accent }}> 39,600円 / 年</b> で全部使えます。
            </p>
          </div>

          <a
            href={WARAWA_LP_URL}
            className="mt-5 block w-full rounded-2xl py-4 text-[15px] font-extrabold no-underline"
            style={{ background: t.ctaBg, color: t.ctaInk }}
          >
            入会に進む（OneSeaキャンペーン）
          </a>
          <p className="mt-2.5 text-[10.5px]" style={{ color: t.sub }}>
            お支払いは OneSea のみ。1回のご入会で四つの扉すべてが開きます。
          </p>
        </section>

        <div className="py-12 text-center">
          <a href="/" className="text-[12px] no-underline" style={{ color: t.sub }}>← 無料アプリOneSeaにもどる</a>
        </div>
      </div>
    </main>
  );
}
