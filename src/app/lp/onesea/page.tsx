import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

export const metadata = {
  title: "わらわ〜会員 — すべての海が、ひらく | OneSea",
  description:
    "MMM・ツキヨガ・セカイムラ・楽市楽座。単体4つで総額210,000円のすべてが、いまなら39,600円/年で。OneSea会員（わらわ〜）へ。",
};

const MINCHO = '"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN",serif';
const GOLD = "#e8d5a0";
const GOLD_GRAD = "linear-gradient(120deg,#f6e9c4,#d4b96a 55%,#f0e6c8)";

const DOORS = [
  { name: "MMM", sub: "地球の音で、同調する", price: "55,000円 / 年", img: "/lp/mmm/hero-cosmos.webp", href: "/lp/mmm" },
  { name: "ツキヨガ", sub: "月と暮らす、トップ講師の学び", price: "66,000円 / 年", img: "/tsukiyoga-v7/moon_nasa_round/moon_15.png", href: "/lp/tsukiyoga", contain: true },
  { name: "セカイムラ", sub: "血のつながらない家族と、村を", price: "41,000円 / 年", img: "/lp/mmm/village.webp", href: "/lp/sekai" },
  { name: "楽市楽座", sub: "あなたの手仕事を、村の家族へ", price: "48,000円 / 年", img: "/rakuichi/logo-emblem.webp", href: "/lp/za", contain: true },
];

export default function Page() {
  return (
    <main
      style={{
        width: "100vw",
        marginLeft: "calc(50% - 50vw)",
        minHeight: "100dvh",
        background: "linear-gradient(180deg,#08111c 0%,#0d1f2e 45%,#0a1622 100%)",
        color: "#eaf1f6",
      }}
    >
      <div className="flex items-center justify-between px-6 py-3" style={{ borderBottom: "1px solid rgba(232,213,160,0.22)" }}>
        <span className="text-[12px] font-extrabold tracking-[3px]" style={{ color: GOLD }}>OneSea</span>
        <a href="/" className="text-[11px] text-[#8fb0c4] no-underline">無料アプリにもどる</a>
      </div>

      {/* ヒーロー（海の夜明け・Adobe Stock） */}
      <section className="relative flex min-h-[76vh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <img src="/lp/onesea/hero-sea.webp" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(8,17,28,0.55),rgba(8,17,28,0.35) 40%,rgba(8,17,28,0.9) 92%)" }} />
        <div className="relative">
          <div className="text-[11px] font-bold tracking-[7px]" style={{ color: GOLD }}>O N E S E A  P R E M I U M</div>
          <h1 className="mt-4 text-[44px] font-extrabold leading-tight tracking-[3px] md:text-[64px]" style={{ fontFamily: MINCHO }}>
            すべての海が、<br className="md:hidden" />ひらく。
          </h1>
          <p className="mx-auto mt-5 max-w-[540px] text-[15px] leading-loose md:text-[18px]" style={{ fontFamily: MINCHO, color: "#dbe8f0" }}>
            見るだけだった四つの扉に、<br />
            きょうから、入れるようになります。
          </p>
          <a href="#price" className="mt-9 inline-block rounded-full px-9 py-4 text-[15px] font-extrabold no-underline" style={{ background: GOLD_GRAD, color: "#14202c" }}>
            わらわ〜会員になる
          </a>
        </div>
      </section>

      {/* 四つの扉 */}
      <div className="mx-auto max-w-[1100px] px-6">
        <h2 className="mt-16 text-center text-[13px] font-bold tracking-[5px]" style={{ color: GOLD }}>四 つ の 扉</h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-[13.5px] leading-loose text-[#9fbccf]">
          OneSeaの中には、それぞれ単体で愛されてきた四つの世界があります。ひとつずつ入れば、合わせて年 <span className="num text-[#e8d5a0]">210,000円</span>。
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {DOORS.map((d) => (
            <Link key={d.name} href={d.href} className="group overflow-hidden rounded-3xl no-underline" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(232,213,160,0.22)" }}>
              <div className="relative h-[168px] overflow-hidden">
                <img src={d.img} alt="" className={"h-full w-full " + (d.contain ? "object-contain p-6 opacity-80" : "object-cover")} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(8,17,28,0.05),rgba(8,17,28,0.7))" }} />
                <div className="absolute bottom-3 left-4">
                  <div className="text-[20px] font-extrabold" style={{ fontFamily: MINCHO, color: "#fff" }}>{d.name}</div>
                  <div className="text-[11.5px] text-[#cdd9e2]">{d.sub}</div>
                </div>
                <span className="num absolute right-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: "rgba(0,0,0,0.5)", color: GOLD }}>{d.price}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5 text-[11.5px]">
                <span className="text-[#9fbccf]">単体プランを見る</span>
                <span style={{ color: GOLD }}>→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 価格の一撃 */}
      <section id="price" className="mx-auto mt-20 max-w-[560px] px-6" style={{ scrollMarginTop: 20 }}>
        <div className="rounded-[32px] px-7 py-10 text-center" style={{ background: "linear-gradient(165deg,rgba(232,213,160,0.10),rgba(255,255,255,0.03))", border: "1.5px solid #e8d5a0" }}>
          <div className="text-[12px] tracking-[3px] text-[#c9b98a]">四つの扉、ぜんぶで</div>
          <div className="num mt-2 text-[22px] font-bold text-[#9fbccf] line-through">年 210,000円</div>
          <div className="mt-4 text-[11px] tracking-[4px]" style={{ color: GOLD }}>いまだけ OneSea キャンペーン</div>
          <div className="num mt-1 text-[56px] font-extrabold leading-none" style={{ color: GOLD }}>
            39,600<span className="text-[18px]"> 円/年</span>
          </div>
          <div className="mt-2 text-[12px] text-[#9fbccf]">1日あたり およそ 108円で、四つの海すべて。</div>

          <div className="mx-auto mt-6 space-y-1.5 rounded-2xl px-5 py-4 text-left text-[12px]" style={{ background: "rgba(255,255,255,0.05)" }}>
            {[["MMM", "55,000円/年"], ["ツキヨガ", "66,000円/年"], ["セカイムラ", "41,000円/年"], ["楽市楽座", "48,000円/年"]].map(([n, p]) => (
              <div key={n} className="flex justify-between">
                <span className="text-[#cdd9e2]">{n}</span>
                <span className="num text-[#9fbccf]">{p}</span>
              </div>
            ))}
            <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1.5 font-extrabold" style={{ color: GOLD }}>
              <span>OneSea会員なら</span>
              <span className="num">39,600円/年</span>
            </div>
          </div>

          {/* 模擬決済ボタン（後日Stripeに差し替え） */}
          <Link
            href="/join/complete"
            className="mt-7 block w-full rounded-2xl py-4 text-[15px] font-extrabold text-white no-underline"
            style={{ background: "linear-gradient(120deg,#2d7bf0,#1a5fd0)", boxShadow: "0 8px 30px rgba(40,110,240,0.4)" }}
          >
            ストライプで 39,600円 を払ってきた（模擬）
          </Link>
          <p className="mt-3 text-[10.5px] text-[#7f9db0]">
            ※決済ページは準備中です。このボタンは動作確認用の模擬入金です。<br />
            お支払いは OneSea のみ。1回のご入会で四つの扉すべてが開きます。
          </p>
        </div>

        <div className="py-14 text-center">
          <a href="/" className="text-[12px] text-[#7f9db0] no-underline">← 無料アプリOneSeaにもどる</a>
        </div>
      </section>
    </main>
  );
}
