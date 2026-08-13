import Link from "next/link";

/* eslint-disable @next/next/no-img-element */

export const metadata = {
  title: "わらわ〜プレミアム会員 — すべての海が、ひらく | OneSea",
  description:
    "MMM・ツキヨガ・セカイムラ・楽市楽座。単体4つで総額214,800円のすべてが、いまなら39,600円/年で。わらわ〜プレミアム会員へ。",
};

const MINCHO = '"Shippori Mincho","Yu Mincho","Hiragino Mincho ProN",serif';
const GOLD = "#e8d5a0";
const GOLD_GRAD = "linear-gradient(120deg,#f6e9c4,#d4b96a 55%,#f0e6c8)";

const DOORS = [
  { name: "MMM", sub: "地球の音で、同調する", price: "年 55,000円", img: "/lp/mmm/hero-cosmos.webp", href: "/lp/mmm" },
  { name: "ツキヨガ", sub: "月と暮らす、トップ講師の学び", price: "月5,500円 = 年 66,000円", img: "/tsukiyoga-v7/moon_nasa_round/moon_15.png", href: "/lp/tsukiyoga", contain: true },
  { name: "セカイムラ", sub: "血のつながらない家族と、村を", price: "入村5,000円+月3,000円 = 年 41,000円", img: "/lp/mmm/village.webp", href: "/lp/sekai" },
  { name: "楽市楽座", sub: "あなたの手仕事を、村の家族へ", price: "月4,400円 = 年 52,800円", img: "/rakuichi/logo-emblem.webp", href: "/lp/za", contain: true },
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
            わらわ〜プレミアム会員になる
          </a>
        </div>
      </section>

      {/* 四つの扉 */}
      <div className="mx-auto max-w-[1100px] px-6">
        <h2 className="mt-16 text-center text-[13px] font-bold tracking-[5px]" style={{ color: GOLD }}>四 つ の 扉</h2>
        <p className="mx-auto mt-3 max-w-[560px] text-center text-[13.5px] leading-loose text-[#9fbccf]">
          OneSeaの中には、それぞれ単体で愛されてきた四つの世界があります。ひとつずつ入れば、合わせて年 <span className="num text-[#e8d5a0]">214,800円</span>。
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

      {/* わらわ〜プレミアム限定特典 */}
      <section className="mx-auto mt-20 max-w-[720px] px-6">
        <h2 className="text-center text-[13px] font-bold tracking-[5px]" style={{ color: GOLD }}>わらわ〜プレミアム限定</h2>

        <div className="mt-6 rounded-3xl px-6 py-7" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(232,213,160,0.22)" }}>
          <div className="text-[18px] font-extrabold" style={{ fontFamily: MINCHO, color: "#fff" }}>月に2回、作家・さとうみつろう氏とZOOM</div>
          <p className="mt-2 text-[13px] leading-loose text-[#cdd9e2]">
            ここでしか話せない内容のトークが聴けます。新月の会と満月の会、月に2回。画面のこちら側とあちら側が、同じ夜にそろう時間です。
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-3xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(232,213,160,0.22)" }}>
          <img src="/lp/onesea/kanon.webp" alt="純正律カノン瞑想コンサート" className="h-[220px] w-full object-cover md:h-[300px]" />
          <div className="px-6 py-6">
            <div className="text-[18px] font-extrabold" style={{ fontFamily: MINCHO, color: "#fff" }}>「純正律カノン瞑想」コンサートに、優先席を。</div>
            <p className="mt-2 text-[13px] leading-loose text-[#cdd9e2]">
              チケットが即完売する「純正律カノン瞑想」のコンサートチケットを、<b style={{ color: GOLD }}>割り引き価格で優先的に購入</b>できます。
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-[14.5px] leading-loose" style={{ fontFamily: MINCHO, color: "#dbe8f0" }}>
          ツキヨガ / 楽市楽座 / MMM / セカイムラ<br />
          さとうみつろう氏が手掛ける有料会員サービスプログラムが、<br />
          すべて<b style={{ color: GOLD }}>「無料」</b>で、わらわ〜プレミアム会員なら受けられます。
        </p>
      </section>

      {/* 価格の一撃 */}
      <section id="price" className="mx-auto mt-14 max-w-[560px] px-6" style={{ scrollMarginTop: 20 }}>
        <div className="rounded-[32px] px-7 py-10 text-center" style={{ background: "linear-gradient(165deg,rgba(232,213,160,0.10),rgba(255,255,255,0.03))", border: "1.5px solid #e8d5a0" }}>
          <div className="text-[12px] tracking-[3px] text-[#c9b98a]">四つの扉＋限定特典、ぜんぶで</div>
          {/* 大きなバッテンで総額を消す */}
          <div className="relative mx-auto mt-2 inline-block px-3">
            <span className="num text-[30px] font-bold text-[#9fbccf]">年 214,800円</span>
            <span aria-hidden className="absolute left-0 top-1/2 h-[4px] w-full -translate-y-1/2 rotate-[8deg] rounded" style={{ background: "#e05050" }} />
            <span aria-hidden className="absolute left-0 top-1/2 h-[4px] w-full -translate-y-1/2 -rotate-[8deg] rounded" style={{ background: "#e05050" }} />
          </div>
          <div className="mt-4 text-[11px] tracking-[4px]" style={{ color: GOLD }}>いまだけ</div>
          <div className="num mt-1 text-[56px] font-extrabold leading-none" style={{ color: GOLD }}>
            39,600<span className="text-[18px]"> 円/年</span>
          </div>
          <div className="mt-2 text-[12px] text-[#9fbccf]">1日あたり およそ 108円で、四つの海すべて。</div>

          <div className="mx-auto mt-6 space-y-1.5 rounded-2xl px-5 py-4 text-left text-[12px]" style={{ background: "rgba(255,255,255,0.05)" }}>
            {[["MMM（年）", "55,000円"], ["ツキヨガ（月5,500円）", "66,000円/年"], ["セカイムラ（入村5,000＋月3,000円）", "41,000円/年"], ["楽市楽座（月4,400円）", "52,800円/年"]].map(([n, p]) => (
              <div key={n} className="flex justify-between gap-2">
                <span className="text-[#cdd9e2]">{n}</span>
                <span className="num flex-shrink-0 text-[#9fbccf]">{p}</span>
              </div>
            ))}
            <div className="mt-1.5 flex justify-between border-t border-white/10 pt-1.5 font-extrabold" style={{ color: GOLD }}>
              <span>わらわ〜プレミアム会員なら</span>
              <span className="num">39,600円/年</span>
            </div>
          </div>

          {/* 模擬決済ボタン（後日Stripeに差し替え） */}
          <Link
            href="/join/complete"
            className="mt-7 block w-full rounded-2xl py-4 text-[15px] font-extrabold text-white no-underline"
            style={{ background: "linear-gradient(120deg,#2d7bf0,#1a5fd0)", boxShadow: "0 8px 30px rgba(40,110,240,0.4)" }}
          >
            いまだけ 39,600円 で入会する（模擬決済）
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
