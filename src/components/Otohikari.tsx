import { LINKS } from "@/lib/config";
import { SchumannPlayer } from "./SchumannPlayer";

const POINTS: Array<[number, number]> = [
  [38, 30], [57, 42], [46, 58], [68, 64], [30, 52],
  [52, 25], [62, 50], [42, 44], [72, 38], [35, 66],
];

/** OTOHIKARI — 光の音柱。世界で同時にシューマン音©を聴く人々の地球儀 */
export function Otohikari() {
  return (
    <section
      className="card"
      style={{
        background: "linear-gradient(160deg,#0a1826,#12283a)",
        border: "1px solid #24405a",
      }}
    >
      <div className="sec" style={{ color: "#8aa8d0" }}>
        OTOHIKARI — 光の音柱
      </div>
      <div className="relative mx-auto my-3 h-40 w-40">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 33% 30%,#2a5a7a,#0f2a45 62%,#081828)",
            boxShadow:
              "0 0 36px rgba(90,160,220,.3),inset -8px -8px 24px rgba(0,0,0,.55)",
          }}
        />
        {POINTS.map(([x, y], i) => (
          <div
            key={i}
            className="absolute h-[5px] w-[5px] rounded-full"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              background: "#ffe08a",
              boxShadow: "0 0 8px 2px rgba(255,220,130,.85)",
            }}
          />
        ))}
      </div>
      <p className="text-center text-[12px] leading-relaxed text-[#7a94b4]">
        世界中で同時に、シューマン音©を毎日5分聴く。
        <br />
        光は、いま聴いている誰かです。
      </p>
      <SchumannPlayer />
      <a
        href={LINKS.mmm}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block rounded-xl border border-[#3e6a88] py-2.5 text-center text-[13px] font-bold text-[#8aa8d0] no-underline"
      >
        OTOHIKARI を MMM でひらく ↗
      </a>
    </section>
  );
}
