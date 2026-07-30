import { Otohikari } from "@/components/Otohikari";
import { TechoCalendar } from "@/components/TechoCalendar";
import { CotozuteFeed } from "@/components/CotozuteFeed";
import { Orbital } from "@/components/Orbital";
import { LINKS } from "@/lib/config";

const DOORS = [
  {
    id: "sekai",
    icon: "🌏",
    name: "セカイムラ",
    desc: "世界は一つの村になる。",
    color: "#4a8a5c",
    bg: "#eff7f0",
    url: LINKS.sekaimura,
  },
  {
    id: "mmm",
    icon: "☀️",
    name: "マスターマインド",
    desc: "毎日5分、聴くだけ。",
    color: "#3e9b6c",
    bg: "#edf7f0",
    url: LINKS.mmm,
  },
  {
    id: "tsuki",
    icon: "🌙",
    name: "ツキヨガ",
    desc: "ツキと身体の関係",
    color: "#5b6ba8",
    bg: "#f0f2fa",
    url: LINKS.tsukiyoga,
  },
  {
    id: "raku",
    icon: "🏮",
    name: "楽市楽座",
    desc: "やりたいことを仕事に",
    color: "#c94d3a",
    bg: "#fdf0ee",
    url: LINKS.rakuza,
  },
] as const;

export default function Home() {
  return (
    <main className="pb-10">
      {/* ロゴヘッダー + 右上MY */}
      <header
        className="px-5 pb-4 pt-5 text-[#e8f0f6]"
        style={{ background: "linear-gradient(160deg,#0e1e2e,#17384e)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-extrabold tracking-[3px] text-[#f0e6c8]">
              Onesea
            </span>
            <span className="ml-2 text-[11px] tracking-widest text-[#7a9ab4]">
              すべての海は、ひとつ。
            </span>
          </div>
          <a
            href={LINKS.rakuzaMyPage}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl px-3 py-1.5 text-[11px] font-extrabold tracking-wider text-[#1a2432] no-underline"
            style={{ background: "#d4b96a" }}
          >
            🪪 MY
          </a>
        </div>
      </header>

      <div className="space-y-3.5 px-4 pt-4">
        {/* ① OTOHIKARI */}
        <Otohikari />

        {/* ② 手帳 */}
        <section className="card px-2.5 py-3">
          <div className="sec mb-2 pl-2">📖 手 帳</div>
          <TechoCalendar />
        </section>

        {/* ③ Cotozute */}
        <CotozuteFeed />

        {/* ④ 星の画像 */}
        <Orbital />

        {/* ⑤ 4つのリンク */}
        <nav className="flex flex-col gap-2.5">
          {DOORS.map((d) => (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 no-underline shadow-sm"
              style={{ background: d.bg, borderColor: `${d.color}40` }}
            >
              <span className="text-2xl">{d.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="text-[15.5px] font-extrabold" style={{ color: d.color }}>
                  {d.name}
                </span>
                <span className="block text-[11px] text-[#a09888]">{d.desc}</span>
              </span>
              <span className="text-base font-extrabold" style={{ color: d.color }}>
                ↗
              </span>
            </a>
          ))}
        </nav>

        {/* フッター */}
        <footer className="pb-4 pt-3 text-center">
          <div className="text-[10.5px] text-[#c8c0b0]">
            手帳と暦は、ずっと無料で使えます
          </div>
          <div className="mt-3 text-[11px] tracking-widest text-[#b8ae9c]">
            🌊 Onesea — すべての海は、ひとつ。
          </div>
        </footer>
      </div>
    </main>
  );
}
