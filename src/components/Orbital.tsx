import { LINKS } from "@/lib/config";

const BODIES = [
  {
    id: "mmm",
    cls: "cel-sun",
    label: "MMM",
    size: 42,
    radius: 132,
    dur: "32s",
    delay: "0s",
    color: "#ffd27a",
    url: LINKS.mmm,
  },
  {
    id: "sekai",
    cls: "cel-earth",
    label: "セカイムラ",
    size: 37,
    radius: 96,
    dur: "21s",
    delay: "-13s",
    color: "#8fe0a8",
    url: LINKS.sekaimura,
  },
  {
    id: "tsuki",
    cls: "cel-moon",
    label: "ツキヨガ",
    size: 31,
    radius: 62,
    dur: "13s",
    delay: "-4s",
    color: "#b8c6f2",
    url: LINKS.tsukiyoga,
  },
] as const;

/** 回る太陽・地球・月。中心に楽市楽座。タップで各サービスへ */
export function Orbital() {
  return (
    <section
      className="card relative h-[348px] overflow-hidden p-0"
      style={{
        background: "radial-gradient(circle at 50% 42%,#16324a,#0c1c2c 76%)",
        border: "1px solid #1e3a52",
      }}
    >
      {[132, 96, 62].map((r) => (
        <div
          key={r}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: r * 2,
            height: r * 2,
            border: "1px dashed rgba(212,185,106,.16)",
          }}
        />
      ))}

      {/* 中心: 楽市楽座 */}
      <a
        href={LINKS.rakuza}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 text-center no-underline"
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%,#e86a50,#b03a28)",
            boxShadow: "0 0 26px rgba(230,110,80,.45)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-za-white.svg" alt="" style={{ width: 38, height: 38 }} />
        </div>
        <div className="mt-1 text-[10.5px] font-bold tracking-wider text-[#ffb8a8]">
          楽市楽座
        </div>
      </a>

      {BODIES.map((b) => (
        <div
          key={b.id}
          className="orbit"
          style={{ "--t": b.dur, "--d": b.delay } as React.CSSProperties}
        >
          <div className="opos" style={{ "--r": `${b.radius}px` } as React.CSSProperties}>
            <a
              className="opl"
              style={{ "--t": b.dur, "--d": b.delay } as React.CSSProperties}
              href={b.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className={`cel ${b.cls}`} style={{ width: b.size, height: b.size }} />
              <div
                className="mt-1 text-center text-[10px] font-bold tracking-wider"
                style={{ color: b.color, textShadow: "0 1px 4px rgba(0,0,0,.6)" }}
              >
                {b.label}
              </div>
            </a>
          </div>
        </div>
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[10px] tracking-widest text-[#4a6a84]">
        タップして扉をひらく
      </div>
    </section>
  );
}
