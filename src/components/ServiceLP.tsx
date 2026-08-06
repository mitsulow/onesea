import { WARAWA_LP_URL } from "@/lib/warawa";

/* eslint-disable @next/next/no-img-element */

/**
 * サービス別ランディングページの共通レンダラー。
 * 各サービス（ツキヨガ/セカイムラ/MMM/楽市楽座）は自分の価格を大きく見せつつ、
 * 入会ボタンは全て OneSea キャンペーン（模擬決済ページ）へ集約する。
 * ※アプリ共通レイアウトの最大幅を突き破り、PCでは画面いっぱいに表示する。
 */

export type LPThemeName = "tsukiyoga" | "sekai" | "mmm" | "za";

interface LPTheme {
  bg: string; ink: string; sub: string; accent: string; accentSoft: string;
  ctaBg: string; ctaInk: string; heroOverlay: string; panel: string;
}

export interface LPFeature { no: string; title: string; body: string; }
export interface LPStory { img: string; kicker: string; title: string; body: string; }
export interface LPClaim { badge: string; title: string; body: string; }
export interface LPInstructor { monogram: string; role: string; line: string; }

export interface LPConfig {
  key: string;
  theme: LPThemeName;
  brandKicker: string;
  title: string; // ™ 等はこの文字列に含めてよい
  tagline: string;
  lead: string;
  heroImg: string;
  heroContain?: boolean;
  stats?: { value: string; label: string }[];
  featuresHeading: string;
  features: LPFeature[];
  stories?: LPStory[]; // 実写＋文の交互ブロック
  claims?: LPClaim[]; // 特許/研究などの強調ボックス
  instructorsHeading?: string;
  instructors?: LPInstructor[];
  galleryHeading?: string;
  gallery?: { img: string; caption: string }[];
  priceMain: string;
  priceSub?: string;
  priceNote?: string; // 例: 通常110,000円 → 50%OFF
  campaignServices: string; // 例: ツキヨガ・セカイムラ・楽市楽座
}

const THEMES: Record<LPThemeName, LPTheme> = {
  tsukiyoga: {
    bg: "linear-gradient(180deg,#0a0e1c 0%,#111634 45%,#0c1024 100%)",
    ink: "#eae6f2", sub: "#9aa0c4", accent: "#e8d5a0", accentSoft: "rgba(232,213,160,0.28)",
    ctaBg: "linear-gradient(120deg,#f0e6c8,#d4b96a)", ctaInk: "#1a1420",
    heroOverlay: "linear-gradient(180deg,rgba(10,14,28,0.2),rgba(10,14,28,0.9) 88%)", panel: "rgba(255,255,255,0.045)",
  },
  sekai: {
    bg: "linear-gradient(180deg,#0f1a12 0%,#16301d 48%,#0e1a12 100%)",
    ink: "#e8f0e4", sub: "#9bb89f", accent: "#e6c98a", accentSoft: "rgba(120,190,140,0.28)",
    ctaBg: "linear-gradient(120deg,#e8cc90,#c8a860)", ctaInk: "#14231a",
    heroOverlay: "linear-gradient(180deg,rgba(15,26,18,0.22),rgba(15,26,18,0.9) 88%)", panel: "rgba(255,255,255,0.05)",
  },
  mmm: {
    bg: "radial-gradient(130% 90% at 50% 0%,#0e2230 0%,#0a0f16 55%,#06090e 100%)",
    ink: "#e6f4ee", sub: "#8fb2a4", accent: "#7de0a0", accentSoft: "rgba(110,230,150,0.28)",
    ctaBg: "linear-gradient(120deg,#7cf9d4,#35c9a5)", ctaInk: "#05201a",
    heroOverlay: "linear-gradient(180deg,rgba(6,9,14,0.15),rgba(6,9,14,0.9) 88%)", panel: "rgba(255,255,255,0.05)",
  },
  za: {
    bg: "linear-gradient(180deg,#1a0e0a 0%,#2a140e 48%,#180c08 100%)",
    ink: "#f6ece0", sub: "#c9a78e", accent: "#f0c088", accentSoft: "rgba(201,77,58,0.32)",
    ctaBg: "linear-gradient(120deg,#f0dca0,#d4b96a)", ctaInk: "#2a140e",
    heroOverlay: "linear-gradient(180deg,rgba(26,14,10,0.18),rgba(26,14,10,0.88) 88%)", panel: "rgba(255,255,255,0.05)",
  },
};

const MINCHO = '"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN",serif';

export function ServiceLP({ cfg }: { cfg: LPConfig }) {
  const t = THEMES[cfg.theme];

  return (
    // アプリ共通レイアウトの max-width を突き破って画面いっぱいに（PCで端まで届く）
    <main style={{ background: t.bg, color: t.ink, width: "100vw", marginLeft: "calc(50% - 50vw)", minHeight: "100dvh" }}>
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: `1px solid ${t.accentSoft}` }}>
        <span className="text-[12px] font-extrabold tracking-[3px]" style={{ color: t.accent }}>OneSea</span>
        <a href="/" className="text-[11px] no-underline" style={{ color: t.sub }}>無料アプリにもどる</a>
      </div>

      {/* ヒーロー（全幅） */}
      <section className="relative flex min-h-[68vh] flex-col items-center justify-end overflow-hidden px-6 pb-14 pt-20 text-center">
        <img src={cfg.heroImg} alt="" className={"pointer-events-none absolute inset-0 h-full w-full " + (cfg.heroContain ? "object-contain p-16 opacity-45" : "object-cover")} />
        <div className="pointer-events-none absolute inset-0" style={{ background: t.heroOverlay }} />
        <div className="relative mx-auto max-w-[760px]">
          <div className="text-[11px] font-bold tracking-[6px]" style={{ color: t.accent }}>{cfg.brandKicker}</div>
          <h1 className="mt-3 text-[42px] font-extrabold leading-tight tracking-[3px] md:text-[54px]" style={{ fontFamily: MINCHO }}>{cfg.title}</h1>
          <p className="mx-auto mt-5 max-w-[560px] whitespace-pre-line text-[15px] leading-loose md:text-[17px]" style={{ fontFamily: MINCHO }}>{cfg.tagline}</p>
        </div>
      </section>

      {/* 統計バッジ */}
      {cfg.stats && (
        <div className="mx-auto flex max-w-[720px] flex-wrap justify-center gap-4 px-6 py-8">
          {cfg.stats.map((s, i) => (
            <div key={i} className="min-w-[130px] flex-1 rounded-2xl px-4 py-4 text-center" style={{ background: t.panel, border: `1px solid ${t.accentSoft}` }}>
              <div className="num text-[26px] font-extrabold leading-none" style={{ color: t.accent }}>{s.value}</div>
              <div className="mt-1.5 text-[11px]" style={{ color: t.sub }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto max-w-[760px] px-6">
        <p className="mt-8 text-[14.5px] leading-loose" style={{ color: t.sub }}>{cfg.lead}</p>
      </div>

      {/* 実写ストーリー（全幅・交互） */}
      {cfg.stories && (
        <div className="mt-14">
          {cfg.stories.map((s, i) => (
            <section key={i} className="mx-auto grid max-w-[1100px] items-center gap-6 px-6 py-8 md:grid-cols-2" style={{ direction: "ltr" }}>
              <div className={"overflow-hidden rounded-3xl " + (i % 2 ? "md:order-2" : "")} style={{ border: `1px solid ${t.accentSoft}` }}>
                <img src={s.img} alt="" className="h-[220px] w-full object-cover md:h-[300px]" />
              </div>
              <div className={i % 2 ? "md:order-1" : ""}>
                <div className="text-[11px] font-bold tracking-[3px]" style={{ color: t.accent }}>{s.kicker}</div>
                <h3 className="mt-2 text-[22px] font-extrabold leading-snug" style={{ fontFamily: MINCHO }}>{s.title}</h3>
                <p className="mt-3 text-[13.5px] leading-loose" style={{ color: t.sub }}>{s.body}</p>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 特許・研究などの強調ボックス */}
      {cfg.claims && (
        <div className="mx-auto mt-6 grid max-w-[1000px] gap-4 px-6 md:grid-cols-2">
          {cfg.claims.map((c, i) => (
            <div key={i} className="rounded-3xl px-6 py-6" style={{ background: t.panel, border: `1.5px solid ${t.accent}` }}>
              <span className="inline-block rounded-full px-3 py-1 text-[10.5px] font-extrabold" style={{ background: t.accent, color: t.ctaInk }}>{c.badge}</span>
              <h3 className="mt-3 text-[17px] font-extrabold leading-snug" style={{ fontFamily: MINCHO }}>{c.title}</h3>
              <p className="mt-2 text-[13px] leading-loose" style={{ color: t.sub }}>{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* 特徴（PCは2列） */}
      <div className="mx-auto max-w-[1000px] px-6">
        <h2 className="mt-16 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.featuresHeading}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {cfg.features.map((f) => (
            <div key={f.no} className="flex gap-4 rounded-2xl px-5 py-5" style={{ background: t.panel, border: `1px solid ${t.accentSoft}` }}>
              <span className="num text-[26px] font-extrabold leading-none" style={{ color: t.accent, opacity: 0.5 }}>{f.no}</span>
              <div>
                <div className="text-[14.5px] font-extrabold">{f.title}</div>
                <div className="mt-1 text-[12.5px] leading-relaxed" style={{ color: t.sub }}>{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        {cfg.instructors && (
          <>
            <h2 className="mt-16 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.instructorsHeading}</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {cfg.instructors.map((ins, i) => (
                <div key={i} className="rounded-2xl px-2 py-5 text-center" style={{ background: t.panel, border: `1px solid ${t.accentSoft}` }}>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-[22px] font-extrabold" style={{ border: `2px solid ${t.accent}`, color: t.accent, fontFamily: "serif" }}>{ins.monogram}</div>
                  <div className="mt-3 text-[12px] font-extrabold">{ins.role}</div>
                  <div className="mt-1 text-[10.5px] leading-snug" style={{ color: t.sub }}>{ins.line}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-[10.5px]" style={{ color: t.sub }}>※講師のお名前・お写真はまもなく公開します</p>
          </>
        )}

        {cfg.gallery && (
          <>
            <h2 className="mt-16 text-[13px] font-bold tracking-[4px]" style={{ color: t.accent }}>{cfg.galleryHeading}</h2>
            <div className="hide-scrollbar mt-4 flex gap-3 overflow-x-auto pb-1">
              {cfg.gallery.map((g, i) => (
                <div key={i} className="w-[240px] flex-shrink-0 overflow-hidden rounded-2xl" style={{ border: `1px solid ${t.accentSoft}` }}>
                  <img src={g.img} alt="" className="h-[150px] w-full object-cover" />
                  <div className="px-3 py-2 text-[11px]" style={{ color: t.sub, background: "rgba(0,0,0,0.25)" }}>{g.caption}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 価格 + キャンペーン導線 */}
        <section className="mx-auto mt-20 max-w-[520px] rounded-[28px] px-6 py-9 text-center" style={{ background: t.panel, border: `1.5px solid ${t.accent}` }}>
          <div className="text-[11px] font-bold tracking-[3px]" style={{ color: t.sub }}>{cfg.title} 単体プラン</div>
          {cfg.priceNote && <div className="num mt-2 text-[13px] line-through" style={{ color: t.sub }}>{cfg.priceNote}</div>}
          <div className="num mt-1 text-[40px] font-extrabold leading-none" style={{ color: t.accent }}>{cfg.priceMain}</div>
          {cfg.priceSub && <div className="num mt-2 text-[12px]" style={{ color: t.sub }}>{cfg.priceSub}</div>}

          <div className="mx-auto mt-6 max-w-[440px] rounded-2xl px-4 py-4 text-left" style={{ background: "rgba(255,255,255,0.06)", border: `1px dashed ${t.accent}` }}>
            <div className="text-[12px] font-extrabold" style={{ color: t.accent }}>いま、OneSeaキャンペーン中</div>
            <p className="mt-1 text-[12px] leading-relaxed" style={{ color: t.ink }}>
              {cfg.title}に加えて<b>{cfg.campaignServices}</b>の全機能が、単体4つ分の総額 <span className="num">210,000円</span> のところ
              <b className="num" style={{ color: t.accent }}> 39,600円 / 年</b> で全部使えます。
            </p>
          </div>

          <a href={WARAWA_LP_URL} className="mt-5 block w-full rounded-2xl py-4 text-[15px] font-extrabold no-underline" style={{ background: t.ctaBg, color: t.ctaInk }}>
            入会に進む（OneSeaキャンペーン）
          </a>
          <p className="mt-2.5 text-[10.5px]" style={{ color: t.sub }}>お支払いは OneSea のみ。1回のご入会で四つの扉すべてが開きます。</p>
        </section>

        <div className="py-14 text-center">
          <a href="/" className="text-[12px] no-underline" style={{ color: t.sub }}>← 無料アプリOneSeaにもどる</a>
        </div>
      </div>
    </main>
  );
}
