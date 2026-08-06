import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "セカイムラ — 世界は、ひとつの村になる | OneSea",
  description:
    "全国の拠点、月に二度の新月会・満月会、村人ラウンジ。血のつながらない家族と出会うコミュニティ、セカイムラ。",
};

const cfg: LPConfig = {
  key: "sekai",
  theme: "sekai",
  brandKicker: "S E K A I M U R A",
  title: "セカイムラ",
  tagline: "世界は、ひとつの村になる。\n血のつながらない家族と、出会う場所。",
  lead: "セカイムラは、全国に生まれた拠点と、月に二度の集いでつながるコミュニティです。米づくり、古民家、神社町、助け合い。オンラインとリアルを行き来しながら、あなたの「村」を見つけていきます。",
  heroImg: "/sekai/cafe-photo.webp",
  featuresHeading: "セカイムラでできること",
  features: [
    { no: "1", title: "新月会・満月会に参加", body: "月に二度、全国の村人とZoomで集う会。過去の会のアーカイブも見られます。" },
    { no: "2", title: "各地の拠点に加わる／つくる", body: "セカイムラ京都、セカイムラ神奈川…。参加するのも、あなたの土地で新しく立ち上げるのも自由。" },
    { no: "3", title: "村人ラウンジ喫茶", body: "いつでも開いているオンラインの喫茶店。3人集まればオープン、顔を見て・声で・文字で話せます。" },
    { no: "4", title: "米部・神社町・助け合い", body: "田んぼの実績台帳、朔日の奉告、助けての掲示板。暮らしの技を持ち寄る場所。" },
  ],
  galleryHeading: "過去の新月会・満月会",
  gallery: [
    { img: "/sekai/moot-thumb-1.webp", caption: "満月会アーカイブ" },
    { img: "/sekai/moot-thumb-2.webp", caption: "新月会アーカイブ" },
    { img: "/sekai/moot-thumb-3.webp", caption: "満月会アーカイブ" },
    { img: "/sekai/moot-thumb-4.webp", caption: "新月会アーカイブ" },
  ],
  priceMain: "月 3,000円",
  priceSub: "単体プラン（入村料 5,000円 ＋ 月額 3,000円）",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
