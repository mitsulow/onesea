import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "セカイムラ — 血のつながらない家族と、村をつくる | OneSea",
  description:
    "ロシアのダーチャに学ぶ、畑付きシェアハウスを全国100か所へ。自然農・古民家再生・新月会満月会。魚をもらうのではなく、魚の釣り方を。入会金5,000円＋月3,000円。",
};

const cfg: LPConfig = {
  key: "sekai",
  theme: "sekai",
  brandKicker: "S E K A I M U R A",
  title: "セカイムラ",
  tagline: "世界は、ひとつの村になる。\n血のつながらない家族と、\n畑と古民家から、村をつくる。",
  lead: "セカイムラは、ロシアの「ダーチャ（郊外の菜園付き別荘）」制度に学ぶオンライン村コミュニティです。都市の人が地方の農地や空き家に関わり、週末を過ごす「畑付きシェアハウス」を全国につくっていく。魚をもらうのではなく、魚の釣り方を——国の制度に頼らず、農と暮らしの自給を学び合う場所です。",
  heroImg: "/lp/mmm/village.webp",
  stats: [
    { value: "全国", label: "各地に拠点をつくる挑戦" },
    { value: "2万人", label: "がDDPを掲げ現実化してきた" },
    { value: "月2回", label: "新月会・満月会でつながる" },
  ],
  featuresHeading: "セカイムラでできること",
  features: [
    { no: "1", title: "畑付きシェアハウスを全国100か所へ", body: "空き家・耕作放棄地の情報、自然農の指導、古民家再生のノウハウ。仲間と直す“リアルRPG”で、村の拠り所をつくります。" },
    { no: "2", title: "DDPを現実化する", body: "端的な夢（DDP）を公開し、仲間のフィードバックで具体化。曖昧な願いが、動ける目標に変わります。" },
    { no: "3", title: "新月会・満月会", body: "月に二度、全国の拠点をZoomでつなぐ集い。検閲のない村の掲示板で、地に足のついたつながりを。" },
    { no: "4", title: "村の通貨「ルンル」", body: "手づくりの品やサービスを、円ではなく村内通貨ルンルで交換。リスクなく起業の練習ができます。" },
    { no: "5", title: "米部・古民家・神社町", body: "田んぼの実績台帳、古民家の再生、朔日の奉告。暮らしの技を持ち寄る部活動。" },
    { no: "6", title: "発酵リゾートの会員割引", body: "日本初のヴィーガン認証・無添加清掃の「暮らしの発酵ライフスタイルリゾート」（沖縄）を特別価格で。" },
  ],
  stories: [
    {
      img: "/sekai/cafe-photo.webp",
      kicker: "LOUNGE",
      title: "いつでも開いている、村人ラウンジ喫茶",
      body: "3人集まればオープンするオンラインの喫茶店。顔を見て、声で、文字で。全国どこにいても、村の誰かとお茶ができます。",
    },
    {
      img: "/lp/mmm/village.webp",
      kicker: "REAL ROLE-PLAYING GAME",
      title: "空き家を、みんなで直す",
      body: "耕作放棄地と古民家を、村人が手を動かして甦らせる“リアルなRPG”。完成した拠点は、地域の家族が集まる場所になります。",
    },
  ],
  galleryHeading: "過去の新月会・満月会",
  gallery: [
    { img: "/sekai/moot-thumb-1.webp", caption: "満月会アーカイブ" },
    { img: "/sekai/moot-thumb-2.webp", caption: "新月会アーカイブ" },
    { img: "/sekai/moot-thumb-3.webp", caption: "満月会アーカイブ" },
    { img: "/sekai/moot-thumb-4.webp", caption: "新月会アーカイブ" },
  ],
  priceMain: "月 3,000円",
  priceSub: "単体プラン（入村料 5,000円 ＋ 月額 3,000円 ＝ 年 41,000円 ／ 学割 入会金2,500・月1,500円）",
  campaignServices: "MMM・ツキヨガ・楽市楽座",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
