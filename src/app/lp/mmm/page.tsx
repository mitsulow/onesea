import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "MMM（マスターマインドメンバーズ）— 地球の音で、同調する | OneSea",
  description:
    "実測シューマン共振を音に変えて聴く瞑想・アイディア・シンクロ。同じ市町村5人のニューラ活動で、互いの願いを叶えるMMM。",
};

const cfg: LPConfig = {
  key: "mmm",
  theme: "mmm",
  brandKicker: "M A S T E R M I N D",
  title: "MMM",
  tagline: "地球の音で、心をそろえる。\nいまこの瞬間の鼓動に、同調する。",
  lead: "MasterMindMembers（MMM）は、地球の鼓動＝シューマン共振を実測し、その周波数を音に変えて聴くコミュニティです。瞑想・アイディア・シンクロの音響プログラムと、同じ町の5人で願いを叶え合うニューラ活動。目標は 8.02Hz、みんなで揃えていきます。",
  heroImg: "/icons/cel-sun.png",
  heroContain: true,
  featuresHeading: "MMMの体験",
  features: [
    { no: "1", title: "シューマン音のフル再生", body: "トムスクの実測から作る音響プログラム。瞑想モード・アイディアモード・シンクロモードのすべてを制限なく。" },
    { no: "2", title: "いま聴いている人が地球儀に灯る", body: "世界中で同じ音を聴く人が、光となって地球儀に現れます。ひとりじゃない瞑想。" },
    { no: "3", title: "ニューラ活動（5人1組）", body: "同じ市町村の5人でチームを組み、冬至までに互いのDDP（端的な願い）を叶え合う。" },
    { no: "4", title: "OTOHIKARIマップ", body: "世界の雷とシューマン共振、聴いている人の光。地球の今を、ひとつの画面で。" },
  ],
  galleryHeading: "三つのモード",
  gallery: [
    { img: "/icons/mode-meditation.webp", caption: "瞑想モード — 静寂に還る" },
    { img: "/icons/mode-idea.webp", caption: "アイディアモード — 叡智に接続" },
    { img: "/icons/mode-synchro.webp", caption: "シンクロモード — 全体につながる" },
  ],
  priceMain: "55,000円 / 年",
  priceSub: "単体プラン（正規年会費）",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
