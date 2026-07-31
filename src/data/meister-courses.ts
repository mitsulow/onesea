/**
 * 百姓マイスター講座。
 * videos にあとから YouTube リンクをどんどん追加していく。
 * 例: { title: "第1回 麹づくり", url: "https://youtu.be/xxxx" }
 */
export interface MeisterVideo {
  title: string;
  url: string;
}

export interface MeisterCourse {
  id: string;
  emoji: string;
  title: string;
  videos: MeisterVideo[];
}

export const MEISTER_COURSES: MeisterCourse[] = [
  { id: "miso", emoji: "🥣", title: "味噌づくり講座", videos: [] },
  { id: "kome", emoji: "🌾", title: "お米を自分で作れるようになる講座", videos: [] },
  { id: "shio", emoji: "🧂", title: "自分で作るお塩づくり", videos: [] },
  { id: "saien", emoji: "🥬", title: "無農薬の家庭菜園", videos: [] },
  { id: "mokuzo", emoji: "🪵", title: "釘を使わない日本の木造建築", videos: [] },
  { id: "shokubutsu", emoji: "🌿", title: "植物と会話する講座", videos: [] },
];
