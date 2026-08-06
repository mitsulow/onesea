import { ServiceLP, LPConfig } from "@/components/ServiceLP";

export const metadata = {
  title: "楽市楽座 — 0円出品から、日本人総フリーランス化へ | OneSea",
  description:
    "お試し・物々交換・投げ銭。誰でも買えて、わらわ〜会員は出品できる楽市楽座。あなたの手仕事を、村の家族へ。",
};

const cfg: LPConfig = {
  key: "za",
  theme: "za",
  brandKicker: "R A K U I C H I  R A K U Z A",
  title: "楽市楽座",
  tagline: "あなたの手仕事を、村の家族へ。\n0円出品から、日本人総フリーランス化計画。",
  lead: "楽市楽座は、OneSeaの中のマーケットです。プロの商品も、0円のお試しも、物々交換も。閲覧と購入は誰でも、出品はOneSea会員から。取引の相談はそのままTALKで。信頼でつながる、村の市場です。",
  heroImg: "/rakuichi/logo-emblem.webp",
  heroContain: true,
  featuresHeading: "楽市楽座の仕組み",
  features: [
    { no: "1", title: "楽市 — 0円・物々交換", body: "無料でゆずる、交換する。お金を介さないやりとりが、村の関係をつくります。" },
    { no: "2", title: "楽座 — プロの出品", body: "手仕事・食・技。あなたの仕事を出品し、投げ銭やお試し価格でも届けられます。" },
    { no: "3", title: "商談はTALKで", body: "気になった品は、出品者とそのままTALK（メッセージ・ビデオ通話）でやりとり。" },
    { no: "4", title: "共通のマイページ名刺", body: "五つのサービス共通のマイページが、あなたの信頼の名刺になります。" },
  ],
  priceMain: "月 4,000円",
  priceSub: "単体プラン（出品・年 48,000円分）",
};

export default function Page() {
  return <ServiceLP cfg={cfg} />;
}
