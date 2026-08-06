import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "Master Mind Members 2026 — 地球と響きあう音の柱 | OneSea",
  description:
    "地球のシューマン共振を利用した特殊音源を1日1回聴くだけ。世界中の仲間と深くつながるマスターマインド。2026年は55,000円、いまOneSeaキャンペーンで全機能39,600円。",
};

const cfg: LPConfig = {
  key: "mmm",
  theme: "mmm",
  brandKicker: "M A S T E R  M I N D  M E M B E R S  2 0 2 6",
  title: "MMM",
  tagline: "地球と響きあう、音の柱。\n1日1回、地球の鼓動を聴くだけで、\n世界中の仲間と深くつながる。",
  lead: "Master Mind Members では、地球のシューマン共振を利用した「特殊な音源」を1日に1回聴くだけで、地球上の多くの仲間と深いつながりを持てます。鉄鋼王アンドリュー・カーネギーが説いた「マスターマインド（志を同じくする者の集合精神）」を、地球そのものの周波数で結ぶ——それがMMMです。",
  heroImg: "/lp/mmm/hero-cosmos.webp",
  stats: [
    { value: "65%", label: "メンバーがDDPを叶えた（2025）" },
    { value: "95%", label: "がマスターマインドに満足" },
    { value: "366", label: "四季でめぐる音源（毎日更新）" },
  ],
  featuresHeading: "MMMでできること",
  features: [
    { no: "1", title: "シューマン音™ のフル再生", body: "実測シューマン共振から作る音響プログラム。瞑想・アイディア・シンクロの全モードを毎日、制限なく。" },
    { no: "2", title: "いま聴いている仲間が地球儀に灯る", body: "世界中で同じ音を聴く人が、光となって地球儀に現れます。ひとりじゃない、地球規模のマスターマインド。" },
    { no: "3", title: "5人1組のニューラ活動", body: "同じ市町村の5人でチームを組み、冬至までに互いのDDP（端的な願い）を叶え合う。" },
    { no: "4", title: "大使・さとうみつろうとのZoom", body: "定期的なZoomセッション。ピュアチューニングカノン瞑想コンサート（全国12会場）へ優先ご招待。" },
    { no: "5", title: "まんまるマルシェ・Lei村", body: "10月10日の全国ポップアップ「大人のリアルおままごと」。兵庫のLei村リトリートは宿泊10%OFF。" },
    { no: "6", title: "セカイムラも使える", body: "米部・新月会満月会など、セカイムラのオンライン機能もそのまま。四つの扉がひとつに。" },
  ],
  stories: [
    {
      img: "/lp/mmm/globe.webp",
      kicker: "SCHUMANN RESONANCE",
      title: "地球の“基音”、シューマン共振",
      body: "地表と電離層のあいだで共鳴する地球固有の電磁波、それがシューマン共振です。MMMはこの周波数を実測し、四季（冬至・春分・夏至・秋分）ごとに 7.89Hz・7.92Hz・7.95Hz として音に変換。地球のリズムに、あなたの一日を重ねます。",
    },
    {
      img: "/lp/mmm/carnegie.webp",
      kicker: "MASTER MIND",
      title: "成功者は、皆これを持っていた",
      body: "鉄鋼王カーネギーの研究が示したのは、成功した人たちが例外なく「マスターマインド＝志を同じくする者の集合精神」を築いていたこと。MMMはその集合精神を、地球の周波数で世界中に広げる試みです。",
    },
  ],
  claims: [
    {
      badge: "特許申請中",
      title: "脳内にシューマン共振と同じ強度の周波数を生成",
      body: "特許申請中の特殊技術により、シューマン共振電磁波と同じ強度の 1pT（ピコテスラ）の周波数を、聴くことを通じて脳内に生成します。ピラミッド構造の中で1億円超のピアノを用いて収録した、地球の自然なリズムそのものの音です。",
    },
    {
      badge: "神戸大学との共同研究",
      title: "体内の水のスペクトラムが変わることを実証",
      body: "神戸大学との研究により、シューマン音™ を聴いた後、体内の水のスペクトラムが変化することが実証されました。地球の周波数が、私たちの身体の水にまで届いている——その科学的な裏づけです。",
    },
  ],
  galleryHeading: "四季でめぐる、地球の音",
  gallery: [
    { img: "/lp/mmm/season-winter.webp", caption: "冬至 — 7.89Hz" },
    { img: "/lp/mmm/season-spring.webp", caption: "春分 — 7.92Hz" },
    { img: "/lp/mmm/season-summer.webp", caption: "夏至 — 7.95Hz" },
    { img: "/lp/mmm/season-autumn.webp", caption: "秋分 — 7.92Hz" },
  ],
  priceMain: "55,000円 / 年",
  priceNote: "通常 110,000円",
  priceSub: "2026年は50%OFF（冬至までの中期入会は27,500円）",
  campaignServices: "ツキヨガ・セカイムラ・楽市楽座",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
