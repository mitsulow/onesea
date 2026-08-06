import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "ツキヨガ — 月と暮らす、日本トップクラスの学び | OneSea",
  description:
    "月の満ち欠けと呼吸を合わせるツキヨガ。日本トップクラスの講師3名によるZoomレッスンと、月齢×12タイプの統計をあなたの毎日へ。",
};

const cfg: LPConfig = {
  key: "tsukiyoga",
  theme: "tsukiyoga",
  brandKicker: "T S U K I Y O G A",
  title: "ツキヨガ",
  tagline: "月の満ち欠けに、呼吸をあわせる。\n体と心を、地球のリズムへ還す時間。",
  lead: "ツキヨガは、月の満ち欠け・潮の満ち引き・あなたの生まれた瞬間の月をひとつにつなぐ、新しいヨガの道です。日本トップクラスの講師によるZoomレッスンと、暦・月齢の統計を毎日の暮らしに重ねます。",
  heroImg: "/tsukiyoga-v7/moon_nasa_round/moon_15.png",
  heroContain: true,
  featuresHeading: "ツキヨガが大切にすること",
  features: [
    { no: "1", title: "月のリズムで、体をひらく", body: "新月は内へ、満月は外へ。月相ごとに設計されたプログラムで、無理なく心身をととのえます。" },
    { no: "2", title: "生まれた月から、あなたを知る", body: "誕生日・誕生時刻・生まれた場所から導く12タイプ。統計にもとづく「今日のあなたと月」を毎日お届けします。" },
    { no: "3", title: "トップ講師のZoomレッスン", body: "日本を代表する3名の講師による、少人数の生レッスン。画面ごしでも、その場の呼吸が伝わります。" },
    { no: "4", title: "暦・潮汐と一体の手帳", body: "節分かれつ刻・潮の時刻・月の出入りを、あなたの手帳の上で。ツキヨガはOneSeaの暦と地続きです。" },
  ],
  stories: [
    {
      img: "/tsukiyoga-v7/moon_nasa_round/moon_15.png",
      kicker: "MOON PHASES",
      title: "月相ごとに、体をひらく",
      body: "新月は内へ、満月は外へ。月の満ち欠けに沿って設計されたプログラムで、無理なく心身をととのえます。潮の満ち引き・月の出入りも、あなたの手帳の上に。",
    },
  ],
  instructorsHeading: "講師 — 日本トップクラスの3名",
  instructors: [
    { monogram: "壱", role: "月と呼吸の講師", line: "満ち欠けに沿う呼吸法の第一人者" },
    { monogram: "弐", role: "身体と姿勢の講師", line: "月相別プログラムの設計者" },
    { monogram: "参", role: "月と心の講師", line: "月齢と心の統計を読み解く" },
  ],
  priceMain: "5,500円 / 月",
  priceSub: "単体プラン（年 66,000円分）",
  campaignServices: "MMM・セカイムラ・楽市楽座",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
