/**
 * 新月会・満月会の動画。
 * 開催後、LATEST に今回の動画を入れ、過去分は PAST の先頭に足していく。
 * url が null のうちはサムネだけ表示（リンクなし）。
 */
export interface MootVideo {
  title: string;
  thumb: string;
  url: string | null;
}

/** 直近開催回の動画（開催されたらここに） */
export const LATEST_MOOT_VIDEO: MootVideo | null = null;

/** 過去の新月会・満月会 動画（新しい順・URLはいまダミー） */
export const PAST_MOOT_VIDEOS: MootVideo[] = [
  { title: "満月会", thumb: "/sekai/moot-thumb-1.webp", url: "https://youtu.be/Dk0fLwpguuk" },
  { title: "新月会", thumb: "/sekai/moot-thumb-2.webp", url: "https://youtu.be/m1Hqs2AJRcI" },
  { title: "満月会", thumb: "/sekai/moot-thumb-3.webp", url: "https://youtu.be/LoRJnzfrgWI" },
  { title: "新月会", thumb: "/sekai/moot-thumb-4.webp", url: "https://youtu.be/M8S13FnnCKY" },
];
