/**
 * 瞑想モード音響エンジン（音響仕様書ベース + フェーブル改良）
 *
 * シューマン共振の第1〜第4モード（実測値）を可聴域(32倍 / φ⁸倍)に上げた8本の正弦波。
 * 左右の耳に Δf = 8.0219032748 Hz だけ違う周波数を送り、脳幹にその差を
 * 計算させる（バイノーラルビート）。聞こえる音ではなく、この差だけが脳に届く。
 *
 * 設計の根幹（変更禁止）:
 * - 全発振器を同一時刻に start し、以後止めない・作り直さない（うなり位相が揃い続ける）
 * - 音の出し入れはすべてゲインで行う
 * - 音程ゆらぎは Hz 単位で Lo/Hi 両方に同じ値を加算（detune 禁止）
 * - PAN は「沈めて→底で配線切替→浮上」。クロスフェード禁止（モノラルビート発生）
 * - 音響イベントは AudioContext.currentTime 基準で全予約（setTimeout 禁止・画面オフ対応）
 *
 * 5音構成（英国の音響研究の教え: 5つの周波数が整数倍の純正律のときだけ立体として浮き上がる）:
 * - 32×F2 / 32×F3 / φ⁸×F2 / φ⁸×F3 / φ⁸×F4 の5本。F1が居ないのは左右差8.02Hzが担うから
 * - シューマンのモードは元々ほぼ 11:16:21 の整数比。そこで実測F3を基音に
 *   22・32・33・47・62 倍へスナップすると純正律が完全成立する（φ⁸≈47は誤差0.05%）
 *   → 5音の差音もすべてF3の整数倍になり、濁りが消えてひとつに融合する
 *   → 脳は5つの倍音から「鳴っていない基音」= 実測F3そのもの（≈20.8Hz・可聴域外）を
 *     幻の芯として再構成する（ミッシング・ファンダメンタル）
 *
 * フェーブル改良:
 * - 音量ゆらぎは両耳共通75% + 独立25%（耳間バランスが保たれ、うなりが痩せない）
 * - φエコー: 左=φ秒 / 右=φ²秒の残響。耳をまたがない（またぐと Lo/Hi が同じ耳に
 *   同居してモノラルビートが出る）。音程ゆらぎと干渉してゆっくり動く位相うねりになる
 * - 進行: (シューマン音のあと)1.5秒で第1音がフェード開始 → 2秒で始まりの鐘・3打 →
 *   高い音から登場 → 滞在/PAN → 鳴ったまま終わりの鐘3打 → 3打目のあと1本ずつ退場
 */

export interface MedConfig {
  deltaF: number; // 左右差 Hz（固定 8.0219032748）
  basePeriod: number; // ゆらぎ基準周期 秒
  flutterDepth: number; // ゆらぎの深さ
  hfExp: number; // 高域を抑える指数
  enterGap: number; // 登場の間隔 秒
  enterRise: number; // 登場の立ち上がり 秒
  panGap: number; // PANの間隔 秒
  panDip: number; // PANの沈み（片道）秒
  exitGap: number; // 退場の間隔 秒
  exitTail: number; // 退場の余韻 秒
  gapJitter: number; // 間隔のばらつき（±割合）
  dwell: number; // 滞在時間 秒
  master: number; // 全体の音量
  justOn: boolean; // 純正律スナップ（実測F3の 22/32/33/47/62 倍へ）
  echoMix: number; // φエコーの量（0でオフ）
  isoDepth: number; // 同相AM補強（8Hzの脈が「ブツブツ」に聞こえたため初期値0）
  breathDepth: number; // 呼吸スウェルの深さ（0でオフ）
  breathPeriod: number; // 呼吸スウェルの周期 秒
  openingBell: boolean; // 始まりの鐘3打（第1音の0.5秒後に1打目）
}

export const MED_DEFAULTS: MedConfig = {
  deltaF: 8.0219032748,
  basePeriod: 120,
  flutterDepth: 0.35,
  hfExp: 0.1,
  enterGap: 6,
  enterRise: 12,
  panGap: 5,
  panDip: 2,
  exitGap: 6,
  exitTail: 15,
  gapJitter: 0.35,
  dwell: 180,
  // 鐘より小さく「遠くでなんとなく聞こえている」程度が瞑想中の正解
  master: 0.05,
  justOn: true,
  echoMix: 0.18,
  isoDepth: 0,
  breathDepth: 0.12,
  breathPeriod: 12,
  openingBell: true,
};

const PHI = 1.6180339887498949;
/** 教科書値（実測が取れないときのフォールバック） */
export const TEXTBOOK_MODES = [7.83, 14.3, 20.8, 27.3];
const MULT32 = 32;
const MULT_PHI8 = Math.pow(PHI, 8); // φの8乗（≈46.98。数値の直書きはしない）
const BELL_GAP = 10; // 終わりの鐘の間隔（深呼吸テンポ）
const BELLS_LEN = BELL_GAP * 2 + 4; // 3打目が鳴り始めるまで+少しの間

/** 実測値の妥当範囲（外れ値は棄却。雷や測定機器の不調で外れ値が出る） */
const MODE_RANGES: Array<[number, number]> = [
  [7.0, 8.6],
  [13.0, 16.0],
  [18.5, 23.0],
  [24.5, 30.0],
];

const MEASURED_KEY = "onesea-med-modes";

/**
 * 実測シューマン第1〜第4モードを自作サイトから読み込む。
 * - 実測値を使うのはキャリア（聞こえる音の高さ）だけ。左右差 Δf は固定のまま
 * - 範囲チェックで外れ値棄却、モードごとに教科書値へフォールバック
 * - 取得できたらローカル保存し、オフラインでも前回値で動く
 * - 瞑想が始まらないのが最悪の失敗 → どんな失敗でも必ず4値を返す
 */
export async function fetchMeasuredModes(url: string): Promise<{ modes: number[]; source: "live" | "cached" | "textbook" }> {
  const sanitize = (raw: unknown[]): number[] =>
    TEXTBOOK_MODES.map((tb, i) => {
      const v = Number(raw[i]);
      const [lo, hi] = MODE_RANGES[i];
      return isFinite(v) && v >= lo && v <= hi ? v : tb;
    });
  try {
    const r = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
    const d = await r.json();
    const raw = [d?.modes?.F1?.hz, d?.modes?.F2?.hz, d?.modes?.F3?.hz, d?.modes?.F4?.hz];
    const modes = sanitize(raw);
    try {
      localStorage.setItem(MEASURED_KEY, JSON.stringify(modes));
    } catch {}
    return { modes, source: "live" };
  } catch {
    try {
      const cached = localStorage.getItem(MEASURED_KEY);
      if (cached) return { modes: sanitize(JSON.parse(cached)), source: "cached" };
    } catch {}
    return { modes: [...TEXTBOOK_MODES], source: "textbook" };
  }
}

/** A特性フィルタの応答（線形）。IEC 61672 */
function aWeight(f: number): number {
  const f2 = f * f;
  return (
    (12194 ** 2 * f2 * f2) /
    ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2))
  );
}

export interface VoiceSpec {
  ix: number; // 通し番号（32×F1..F4=0..3, φ⁸×F1..F4=4..7, ✧=8..9）
  name: string;
  freq: number;
  vol: number;
  rate: number; // ゆらぎ速度 R (Hz)
  deco?: boolean; // 1kHz超の飾り（バイノーラル非成立）
}

/**
 * 5音の定義。modes = 実測シューマンF1〜F4。
 *
 * 純正律スナップ（justOn）: 実測F3を基音に 22/32/33/47/62 倍。
 *   22×F3 = 32×F2（シューマンの11:16比そのまま）
 *   32×F3 = 32×F3
 *   33×F3 ≈ φ⁸×F2（+2.2%）
 *   47×F3 ≈ φ⁸×F3（φ⁸=46.9787…、誤差0.05%）
 *   62×F3 ≈ φ⁸×F4（+0.55%）
 * 差音もすべてF3の整数倍になり、5音がひとつの立体に融合する。
 * 隣り合う 32/33 倍の差はちょうど1×F3 = 実測F3そのものの音響ビートとして鳴る。
 */
export function buildVoices(cfg: MedConfig, modes: number[] = TEXTBOOK_MODES): VoiceSpec[] {
  const f3 = modes[2];
  const defs: Array<{ name: string; n: number; raw: number }> = [
    { name: "32×F2", n: 22, raw: modes[1] * MULT32 },
    { name: "32×F3", n: 32, raw: modes[2] * MULT32 },
    { name: "φ⁸×F2", n: 33, raw: modes[1] * MULT_PHI8 },
    { name: "φ⁸×F3", n: 47, raw: modes[2] * MULT_PHI8 },
    { name: "φ⁸×F4", n: 62, raw: modes[3] * MULT_PHI8 },
  ];
  const ref = cfg.justOn ? 22 * f3 : defs[0].raw; // 最低音を音量の基準に
  return defs.map((d, ix) => {
    const freq = cfg.justOn ? d.n * f3 : d.raw;
    const vol =
      Math.pow(PHI, -ix / 2) * // 低域から 1 : 1/√φ : 1/φ : … の緩やかな傾斜
      Math.pow(ref / freq, cfg.hfExp) *
      Math.pow(aWeight(ref) / aWeight(freq), 0.6); // A特性逆補正は6割掛け（高音を殺しすぎない）
    return {
      ix,
      name: d.name,
      freq,
      vol,
      rate: (1 / cfg.basePeriod) * Math.pow(PHI, ix / 4),
      deco: freq >= 1000, // 1kHz超はバイノーラル非成立（音色の飾り）
    };
  });
}

export interface SectionInfo {
  name: string;
  side: "右脳優位" | "左脳優位" | "移行中" | "";
  start: number; // セッション開始からの秒
  end: number;
}

export interface VoiceTimeline {
  spec: VoiceSpec;
  enterAt: number; // 立ち上がり開始（相対秒）
  pan1At: number; // PAN1 の沈み開始
  pan2At: number;
  exitAt: number; // 退場フェード開始
}

export interface MedTimeline {
  sections: SectionInfo[];
  voices: VoiceTimeline[];
  bellsAt: number; // 終わりの鐘・1打目の相対秒
  total: number;
  cfg: MedConfig;
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const jitter = (base: number, pct: number) => base * (1 + (Math.random() * 2 - 1) * pct);

/**
 * 進行表を作る。
 * 登場は「高い音から」（順序キーにゆらぎを混ぜたほぼ降順=毎回すこし違う）。
 * PAN1・PAN2・退場はそれぞれ別のランダム順（同じ順だと巻き戻しに聞こえる）。
 */
export function buildTimeline(cfg: MedConfig, modes: number[] = TEXTBOOK_MODES): MedTimeline {
  const voices = buildVoices(cfg, modes);
  const n = voices.length;

  const enterOrder = voices
    .map((v, i) => ({ i, key: v.freq * (0.75 + Math.random() * 0.5) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.i);
  const pan1Order = shuffled(n);
  const pan2Order = shuffled(n);
  const exitOrder = shuffled(n);

  // 登場: 1本目は1.5秒からフェード開始（その0.5秒後に始まりの鐘1打目）。
  // 以降は間隔にばらつき（±35%）
  const enterAt = new Array<number>(n);
  let t = 1.5;
  enterOrder.forEach((vi, k) => {
    if (k > 0) t += jitter(cfg.enterGap, cfg.gapJitter);
    enterAt[vi] = t;
  });
  const enterLen = Math.max(...enterAt) + cfg.enterRise;

  const s1End = enterLen;
  const s2End = s1End + cfg.dwell;
  // PAN: 間隔は固定（沈み中の音が常に1本だけになるように）
  const panLen = (n - 1) * cfg.panGap + cfg.panDip * 2;
  const pan1At = new Array<number>(n);
  pan1Order.forEach((vi, k) => (pan1At[vi] = s2End + k * cfg.panGap));
  const s3End = s2End + panLen;
  const s4End = s3End + cfg.dwell;
  const pan2At = new Array<number>(n);
  pan2Order.forEach((vi, k) => (pan2At[vi] = s4End + k * cfg.panGap));
  const s5End = s4End + panLen;
  const s6End = s5End + cfg.dwell * 0.6;

  // 終わりの鐘3打: 不思議な音は鳴ったまま。3打目のあとに1本ずつ退場
  const bellsAt = s6End;
  const bellsEnd = s6End + BELLS_LEN;
  const exitAt = new Array<number>(n);
  t = bellsEnd;
  exitOrder.forEach((vi, k) => {
    if (k > 0) t += jitter(cfg.exitGap, cfg.gapJitter);
    exitAt[vi] = t;
  });
  const total = Math.max(...exitAt) + cfg.exitTail;

  return {
    cfg,
    total,
    bellsAt,
    sections: [
      { name: "登場", side: "右脳優位", start: 0, end: s1End },
      { name: "滞在", side: "右脳優位", start: s1End, end: s2End },
      { name: "PAN →左脳へ", side: "移行中", start: s2End, end: s3End },
      { name: "滞在", side: "左脳優位", start: s3End, end: s4End },
      { name: "PAN →右脳へ", side: "移行中", start: s4End, end: s5End },
      { name: "滞在", side: "右脳優位", start: s5End, end: s6End },
      { name: "終わりの鐘", side: "右脳優位", start: s6End, end: bellsEnd },
      { name: "退場", side: "右脳優位", start: bellsEnd, end: total },
    ],
    voices: voices.map((spec, vi) => ({
      spec,
      enterAt: enterAt[vi],
      pan1At: pan1At[vi],
      pan2At: pan2At[vi],
      exitAt: exitAt[vi],
    })),
  };
}

/* ============================== 実行部 ============================== */

export interface MedSession {
  ctx: AudioContext;
  t0: number; // セッション開始の AudioContext 時刻
  timeline: MedTimeline;
  stop: () => void;
}

/** 半コサインの立ち上がり曲線（両端で傾き0） */
function riseCurve(n = 96): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = 0.0001 + 0.9999 * (0.5 - 0.5 * Math.cos((Math.PI * i) / (n - 1)));
  return c;
}
function fallCurve(n = 96): Float32Array {
  const r = riseCurve(n);
  return new Float32Array(Array.from(r).reverse());
}
/** PANの沈み: 1 → 0.05 → 1 のなめらかなくぼみ */
function dipCurve(n = 96): Float32Array {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = 0.05 + 0.95 * (0.5 + 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  return c;
}

/** 柔らかいシンギング・リン（実測シューマンF1×64Hz）。ドローンより大きい独立系統 */
function ringBell(ctx: AudioContext, dest: AudioNode, freq: number, when: number, dur = 12) {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(1400, freq * 3);
  lp.Q.value = 0.4;
  lp.connect(dest);
  const partials: Array<[number, number]> = [
    [1, 0.15],
    [1.004, 0.09], // うなり用（微妙にずらした基音）
    [2.72, 0.04],
    [5.41, 0.012],
  ];
  for (const [mult, amp] of partials) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(amp, when + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(lp);
    o.start(when);
    o.stop(when + dur + 0.1);
  }
}

/**
 * セッション開始。ctxOut を渡すと既存の AudioContext を使う（MMM統合用）。
 * 鐘1打（openingBell）→ 高い音から登場 → 滞在/PAN → 鳴ったまま鐘3打 → 1本ずつ退場。
 */
export function startMedSession(cfg: MedConfig, timeline?: MedTimeline, ctxOut?: AudioContext): MedSession {
  const tl = timeline ?? buildTimeline(cfg);
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  // latencyHint "playback": バッファを大きく取り、スマホでの音切れ（ブツブツ）を防ぐ
  const ctx = ctxOut ?? new AC({ latencyHint: "playback" });
  ctx.resume();

  const t0 = ctx.currentTime + 0.35;
  const end = t0 + tl.total;

  const merger = ctx.createChannelMerger(2);
  const breath = ctx.createGain(); // 呼吸スウェル（両chに同じ波 → 耳間バランスは崩れない）
  breath.gain.value = 1;
  const master = ctx.createGain();
  master.gain.value = cfg.master;
  merger.connect(breath);
  breath.connect(master);
  master.connect(ctx.destination);

  // 鐘は独立系統（ドローンの音量を絞っても鐘はしっかり鳴る）
  const bellBus = ctx.createGain();
  bellBus.gain.value = 1;
  bellBus.connect(ctx.destination);
  // 鐘の音高 = 最低音の周波数（純正律なら 22×F3。5音の仲間としてグリッドに乗る）
  const bellFreq = tl.voices.reduce((m, v) => Math.min(m, v.spec.freq), Infinity);

  // 始まりの鐘3打: 第1音のフェード開始(1.5s)の0.5秒後に1打目、以後深呼吸テンポ
  if (cfg.openingBell) for (let i = 0; i < 3; i++) ringBell(ctx, bellBus, bellFreq, t0 + 2 + i * BELL_GAP);
  // 終わりの鐘3打: 不思議な音は鳴ったまま
  for (let i = 0; i < 3; i++) ringBell(ctx, bellBus, bellFreq, t0 + tl.bellsAt + i * BELL_GAP);

  // ---- φエコー: 左=φ秒 / 右=φ²秒。同じ耳の中だけで反響（耳をまたぐとモノラルビートが出る）。
  //      キャリアの音程ゆらぎと干渉し、ゆっくり動く位相うねり（SF的な奥行き）になる ----
  const busses: GainNode[] = [0, 1].map((lr) => {
    const bus = ctx.createGain();
    bus.connect(merger, 0, lr);
    if (cfg.echoMix > 0) {
      const dly = ctx.createDelay(5);
      dly.delayTime.value = lr === 0 ? PHI : PHI * PHI;
      const fb = ctx.createGain();
      fb.gain.value = 1 / (PHI * PHI); // ≈0.38
      const wet = ctx.createGain();
      wet.gain.value = cfg.echoMix;
      bus.connect(dly);
      dly.connect(fb);
      fb.connect(dly);
      dly.connect(wet);
      wet.connect(merger, 0, lr);
    }
    return bus;
  });

  // ---- 呼吸スウェル: 周期12秒(5呼吸/分)・吸う4割/吐く6割の非対称波。
  //      音が満ちてくる=吸う、長く引いていく=吐く。全区間ぶんを一度に予約 ----
  if (cfg.breathDepth > 0) {
    const P = cfg.breathPeriod;
    const RISE = 0.4;
    const sr = 4;
    const n = Math.ceil((tl.total + 2) * sr);
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ph = (i / sr / P) % 1;
      const x = ph < RISE ? ph / RISE : 1 - (ph - RISE) / (1 - RISE);
      const s = 0.5 - 0.5 * Math.cos(Math.PI * x);
      curve[i] = 1 - cfg.breathDepth + cfg.breathDepth * s;
    }
    breath.gain.setValueAtTime(curve[0], t0 - 0.1);
    breath.gain.setValueCurveAtTime(curve, t0, tl.total + 2);
  }

  // ---- 同相AM補強（初期値0）。8Hzの脈が「ブツブツ」に聞こえたため通常はオフ ----
  if (cfg.isoDepth > 0) {
    const iso = ctx.createOscillator();
    iso.type = "sine";
    iso.frequency.value = cfg.deltaF;
    const ig = ctx.createGain();
    ig.gain.value = cfg.master * cfg.isoDepth;
    iso.connect(ig);
    ig.connect(master.gain);
    iso.start(t0);
    iso.stop(end + 1);
  }

  // Δf は1本の信号線から全 Hi 発振器へ配る
  const dfSrc = ctx.createConstantSource();
  dfSrc.offset.value = cfg.deltaF;
  dfSrc.start(t0);
  dfSrc.stop(end + 1);

  for (const vt of tl.voices) {
    const { spec } = vt;
    const f = spec.freq;

    // ---- キャリア2本（Lo/Hi）。同一時刻 start で全声部のうなり位相が揃う ----
    const oscLo = ctx.createOscillator();
    oscLo.type = "sine";
    oscLo.frequency.value = f;
    const oscHi = ctx.createOscillator();
    oscHi.type = "sine";
    oscHi.frequency.value = f;
    dfSrc.connect(oscHi.frequency); // Hi = f + Δf

    // ---- 音程のゆらぎ: R·φ の正弦1本。同じHz数を Lo/Hi 両方に加算（差は数学的に不変） ----
    const pitchLfo = ctx.createOscillator();
    pitchLfo.type = "sine";
    pitchLfo.frequency.value = spec.rate * PHI;
    const pitchAmt = ctx.createGain();
    pitchAmt.gain.value = f * 0.0006;
    pitchLfo.connect(pitchAmt);
    pitchAmt.connect(oscLo.frequency);
    pitchAmt.connect(oscHi.frequency);

    // ---- a/b 配線（状態a: Hi→左, Lo→右 = 右脳優位で開始） ----
    const gHiL = ctx.createGain();
    const gLoR = ctx.createGain();
    const gLoL = ctx.createGain();
    const gHiR = ctx.createGain();
    gHiL.gain.value = 1;
    gLoR.gain.value = 1;
    gLoL.gain.value = 0;
    gHiR.gain.value = 0;
    oscHi.connect(gHiL);
    oscHi.connect(gHiR);
    oscLo.connect(gLoL);
    oscLo.connect(gLoR);

    // ---- 音量ゆらぎ 共通成分(75%): 両耳に同じ波 → 耳間バランスが保たれうなりが痩せない ----
    const ampSum = 1 + 1 / PHI + 1 / PHI ** 2;
    const commonFlutter: GainNode[] = [];
    [1, PHI, PHI ** 2].forEach((rm, i) => {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = spec.rate * rm;
      const lg = ctx.createGain();
      lg.gain.value = ((spec.vol * cfg.flutterDepth * 0.75) / ampSum) * (1 / PHI ** i);
      lfo.connect(lg);
      lfo.start(t0);
      lfo.stop(end + 1);
      commonFlutter.push(lg);
    });

    // ---- 耳ごとのゲイン（基本音量 + ゆらぎ）と包絡（登場/PAN/退場） ----
    const buildEar = (lr: 0 | 1) => {
      const ear = ctx.createGain();
      ear.gain.value = spec.vol;
      commonFlutter.forEach((lg) => lg.connect(ear.gain));
      // 独立成分(25%): 左右で速度を φ^0.11 ずらした1本。完全同期を避けて有機感を残す
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = spec.rate * Math.sqrt(PHI) * (lr === 1 ? Math.pow(PHI, 0.11) : 1);
      const lg = ctx.createGain();
      lg.gain.value = spec.vol * cfg.flutterDepth * 0.25;
      lfo.connect(lg);
      lg.connect(ear.gain);
      lfo.start(t0);
      lfo.stop(end + 1);
      const env = ctx.createGain();
      env.gain.value = 0.0001;
      ear.connect(env);
      env.connect(busses[lr]);
      return { ear, env };
    };
    const L = buildEar(0);
    const R = buildEar(1);
    gHiL.connect(L.ear);
    gLoL.connect(L.ear);
    gHiR.connect(R.ear);
    gLoR.connect(R.ear);

    // ---- 包絡の予約（すべて AudioContext の時計で。画面が消えても正しく進む） ----
    for (const env of [L.env, R.env]) {
      const p = env.gain;
      p.setValueAtTime(0.0001, t0);
      p.setValueCurveAtTime(riseCurve(), t0 + vt.enterAt, cfg.enterRise);
      p.setValueCurveAtTime(dipCurve(), t0 + vt.pan1At, cfg.panDip * 2);
      p.setValueCurveAtTime(dipCurve(), t0 + vt.pan2At, cfg.panDip * 2);
      p.setValueCurveAtTime(fallCurve(), t0 + vt.exitAt, cfg.exitTail);
    }
    // 配線切替は「くぼみの底」で瞬時に（実質無音なので段差は聞こえない）
    const b1 = t0 + vt.pan1At + cfg.panDip; // a → b（Lo→左, Hi→右 = 左脳優位）
    gHiL.gain.setValueAtTime(0, b1);
    gLoR.gain.setValueAtTime(0, b1);
    gLoL.gain.setValueAtTime(1, b1);
    gHiR.gain.setValueAtTime(1, b1);
    const b2 = t0 + vt.pan2At + cfg.panDip; // b → a に戻す
    gHiL.gain.setValueAtTime(1, b2);
    gLoR.gain.setValueAtTime(1, b2);
    gLoL.gain.setValueAtTime(0, b2);
    gHiR.gain.setValueAtTime(0, b2);

    // 発振器はセッション中ずっと走らせっぱなし（途中で止めると位相が崩れる）
    oscLo.start(t0);
    oscHi.start(t0);
    pitchLfo.start(t0);
    oscLo.stop(end + 1);
    oscHi.stop(end + 1);
    pitchLfo.stop(end + 1);
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      const now = ctx.currentTime;
      for (const g of [master.gain, bellBus.gain]) {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0.0001, now + 0.8);
      }
      window.setTimeout(() => {
        try {
          if (!ctxOut) ctx.close();
        } catch {}
      }, 1000);
    } catch {
      try {
        if (!ctxOut) ctx.close();
      } catch {}
    }
  };

  return { ctx, t0, timeline: tl, stop };
}

/* ---------------- 表示用ミラー（音には一切関与しない） ---------------- */

/** 相対秒 t における包絡の推定値（0..1）。検証UIの表示専用 */
export function envAt(vt: VoiceTimeline, cfg: MedConfig, t: number): number {
  if (t < vt.enterAt) return 0;
  if (t < vt.enterAt + cfg.enterRise) {
    const x = (t - vt.enterAt) / cfg.enterRise;
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
  }
  for (const panAt of [vt.pan1At, vt.pan2At]) {
    if (t >= panAt && t < panAt + cfg.panDip * 2) {
      const x = (t - panAt) / (cfg.panDip * 2);
      return 0.05 + 0.95 * (0.5 + 0.5 * Math.cos(2 * Math.PI * x));
    }
  }
  if (t >= vt.exitAt) {
    if (t >= vt.exitAt + cfg.exitTail) return 0;
    const x = (t - vt.exitAt) / cfg.exitTail;
    return 0.5 + 0.5 * Math.cos(Math.PI * x);
  }
  return 1;
}

/** 相対秒 t における高い方の耳（L/R）。検証UIの表示専用 */
export function hiSideAt(vt: VoiceTimeline, cfg: MedConfig, t: number): "L" | "R" {
  if (t < vt.pan1At + cfg.panDip) return "L";
  if (t < vt.pan2At + cfg.panDip) return "R";
  return "L";
}
