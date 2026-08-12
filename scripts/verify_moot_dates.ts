// 検証: 1時間ルール適用後の新月会/満月会の日付と、2026-08-12アンカー採番
import { moonsOfYear } from "../src/lib/almanac";

// 新ルール: 会の開始(13時/20時)から天文点まで1時間未満なら前日開催
function mootTimeOf(ev: { type: "new" | "full"; time: number }): number {
  const hour = ev.type === "new" ? 13 : 20;
  const jst = new Date(ev.time + 9 * 3600000);
  const cand = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), hour) - 9 * 3600000;
  return cand <= ev.time - 3600000 ? cand : cand - 86400000;
}

const raw: Array<{ time: number; kind: "new" | "full"; evTime: number }> = [];
for (const y of [2021, 2022, 2023, 2024, 2025, 2026, 2027]) {
  for (const ev of moonsOfYear(y)) raw.push({ time: mootTimeOf(ev), kind: ev.type, evTime: ev.time });
}
raw.sort((a, b) => a.time - b.time);
const dk = (t: number) => new Date(t + 9 * 3600000).toISOString().slice(0, 10);

// 旧アンカー(2021-08最初の満月会=第1回)での通し番号
const firstIdx = raw.findIndex((m) => m.kind === "full" && m.time >= Date.UTC(2021, 7, 1));
const seq = raw.slice(firstIdx).map((m, i) => ({ ...m, no: i + 1 }));

const anchor = seq.find((m) => m.kind === "new" && dk(m.time) === "2026-08-12");
console.log("2026-08-12 新月会 exists:", !!anchor, anchor ? "旧採番=第" + anchor.no + "回" : "");
const iA = seq.findIndex((m) => m === anchor);
console.log("=== アンカー(126)適用で前後10件 ===");
for (let i = Math.max(0, iA - 5); i < Math.min(seq.length, iA + 6); i++) {
  const m = seq[i];
  const no = anchor ? 126 + (i - iA) : m.no;
  console.log(
    `第${no}回 ${m.kind === "new" ? "新月会" : "満月会"} ${dk(m.time)} ` +
    `(天文点 ${new Date(m.evTime + 9 * 3600000).toISOString().slice(0, 16).replace("T", " ")} JST)`
  );
}
