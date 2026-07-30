/** 料金・特典・パラメータのハードコード禁止ルールにより設定値を集約 */
export const SCHUMANN = {
  /** 現行運用の基本周波数（Hz）。夏至バージョン 7.95Hz */
  hz: 7.95,
  /** 可聴域への逓倍数（7.83Hz × 64 = 501.12Hz が基準） */
  mult: 64,
  /** 無料試聴秒数（フェードアウト込み） */
  freeSec: 10,
  label: "夏至バージョン",
  length: "5:36",
} as const;

/** 目標周波数（恒星日 86,164秒 ÷ (8回転 × 86,400秒) 由来）— schumann API v1 と共通 */
export const TARGET_HZ = 8.0219032748;

/** シューマン共振 実測データ（公式API v1・凍結スキーマ） */
export const SCHUMANN_DATA_URL = "https://mitsulow.github.io/0Lei/schumann_data.json";

/**
 * シューマン音© 音源（令和八年夏至点）。
 * 初回アクセス時に端末へ保存し、以後はローカル再生 — 運営の帯域はほぼゼロ。
 * 一次配信は jsDelivr（GitHub の無料CDN）、失敗時は自サイト配信にフォールバック。
 */
export const AUDIO = {
  url: "https://cdn.jsdelivr.net/gh/mitsulow/onesea@main/public/audio/schumann_r8_geshi.mp3",
  fallbackUrl: "/audio/schumann_r8_geshi.mp3",
} as const;

export const LINKS = {
  sekaimura: "https://sekaimura-gold.vercel.app",
  mmm: "https://mastermindmembers.net",
  tsukiyoga: "https://mitsulow.github.io/0Lei/tsukiyoga_v7.html",
  rakuza: "https://rakuza-ten.vercel.app",
  rakuzaMyPage: "https://rakuza-ten.vercel.app/my",
  rakuzaCotozute: "https://rakuza-ten.vercel.app/posts",
} as const;

/** Onesea 専用 Supabase プロジェクト（東京）。他サービスと認証を共有しない */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://hpgofjkxqguzgrptchqj.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwZ29mamt4cWd1emdycHRjaHFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTE4ODEsImV4cCI6MjEwMDk4Nzg4MX0.RUJeAih2h08bfOPiM6DJfm-_cbTx3X4FCheJ8ZUJhKY";
