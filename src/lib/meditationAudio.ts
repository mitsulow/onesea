/**
 * 瞑想モード音響エンジン（仕様書: 瞑想モード音響仕様書.md 準拠）
 *
 * シューマン共振の第1〜第4モードを可聴域(32倍 / φ⁸倍)に上げた8本の正弦波。
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
 * 仕様書からの改良（音響神経科学的な根拠つき）:
 * 1. 音量ゆらぎの75%を両耳共通に。バイノーラルビートは両耳の音量が揃っているとき
 *    最も深くうなる。左右が独立に±35%揺れると耳間レベル差が開いてうなりが痩せる。
 *    残り25%だけ左右独立に揺らし、有機的な非対称感は保つ
 * 2. 極浅の同相AM（アイソクロニック補強）。脳波の聴性定常応答はバイノーラルより
 *    同相の振幅変調のほうが強い。深さ8%なら「ばっばっば」にはならず、全発振器
 *    同時startのためバイノーラルのうなりと位相も揃った 8.02Hz の二重ドライブになる
 * 3. 呼吸スウェル。全体音量に周期12秒（5呼吸/分＝副交感神経が最大化する帯域）、
 *    吸う4割/吐く6割の非対称な±12%の波を敷き、意識させずに深呼吸へ誘導する
 */

export interface MedConfig {
  deltaF: number; // 左右差 Hz（固定 8.0219032748）
  basePeriod: number; // ゆらぎ基準周期 秒
  flutterDepth: number; // ゆらぎの深さ
  hfExp: number; // 高域を抑える指数
  phi8Coef: number; // φ⁸層の音量係数
  enterGap: number; // 登場の間隔 秒
  enterRise: number; // 登場の立ち上がり 秒
  panGap: number; // PANの間隔 秒
  panDip: number; // PANの沈み（片道）秒
  exitGap: number; // 退場の間隔 秒
  exitTail: number; // 退場の余韻 秒
  gapJitter: number; // 間隔のばらつき（±割合）
  dwell: number; // 滞在時間 秒
  master: number; // 全体の音量
  phi8F2On: boolean; // φ⁸×F2 を鳴らすか（32×F3 と 6.196Hz の音響ビートを作る副産物の元）
  isoDepth: number; // 同相AM補強の深さ（0でオフ）
  breathDepth: number; // 呼吸スウェルの深さ（0でオフ）
  breathPeriod: number; // 呼吸スウェルの周期 秒
}

export const MED_DEFAULTS: MedConfig = {
  deltaF: 8.0219032748,
  basePeriod: 120,
  flutterDepth: 0.35,
  hfExp: 0.25,
  phi8Coef: 0.62,
  enterGap: 6,
  enterRise: 12,
  panGap: 5,
  panDip: 2,
  exitGap: 6,
  exitTail: 15,
  gapJitter: 0.35,
  dwell: 180,
  // 仕様書初期値は 0.16 だが、「開始の鈴より小さく、遠くでなんとなく聞こえている程度」
  // が瞑想中の正解なので初期値はさらに絞る（設定でいつでも上げられる）
  master: 0.06,
  phi8F2On: true,
  isoDepth: 0.08,
  breathDepth: 0.12,
  breathPeriod: 12,
};

const PHI = 1.6180339887498949;
/** 教科書値（実測が取れないときのフォールバック） */
export const TEXTBOOK_MODES = [7.83, 14.3, 20.8, 27.3];
const MULT32 = 32;
const MULT_PHI8 = Math.pow(PHI, 8); // φの8乗（≈46.98。数値の直書きはしない）

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
  ix: number; // 通し番号 0..7（32×F1..F4, φ⁸×F1..F4）
  name: string;
  freq: number;
  vol: number;
  rate: number; // ゆらぎ速度 R (Hz)
}

/** 8本の音の定義（音量は仕様書の計算式そのまま）。modes = 実測シューマンF1〜F4 */
export function buildVoices(cfg: MedConfig, modes: number[] = TEXTBOOK_MODES): VoiceSpec[] {
  const out: VoiceSpec[] = [];
  const baseAmps = [1, 1 / PHI, 1 / PHI ** 2, 1 / PHI ** 3];
  [MULT32, MULT_PHI8].forEach((mult, layer) => {
    modes.forEach((m, mi) => {
      const ix = layer * 4 + mi;
      const freq = m * mult;
      const vol =
        baseAmps[mi] *
        (layer === 1 ? cfg.phi8Coef : 1) *
        Math.pow(250 / freq, cfg.hfExp) *
        (aWeight(250) / aWeight(freq)); // A特性の逆補正（250Hz基準）
      out.push({
        ix,
        name: `${layer === 0 ? "32" : "φ⁸"}×F${mi + 1}`,
        freq,
        vol,
        rate: (1 / cfg.basePeriod) * Math.pow(PHI, ix / 4),
      });
    });
  });
  // φ⁸×F2 は設定でオフにできる（32×F3 665.60Hz と 6.196Hz しか離れておらず、
  // 同じ耳の中でシータ帯の音響ビートが生まれる。悪くない副産物だが意図したものではない）
  return cfg.phi8F2On ? out : out.filter((v) => v.ix !== 5);
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

/** 進行表を作る。登場・PAN1・PAN2・退場はそれぞれ別のランダム順（同じ順だと巻き戻しに聞こえる） */
export function buildTimeline(cfg: MedConfig, modes: number[] = TEXTBOOK_MODES): MedTimeline {
  const voices = buildVoices(cfg, modes);
  const n = voices.length;

  const enterOrder = shuffled(n);
  const pan1Order = shuffled(n);
  const pan2Order = shuffled(n);
  const exitOrder = shuffled(n);

  // 登場: 間隔にばらつき（±35%）。1本目は即
  const enterAt = new Array<number>(n);
  let t = 0;
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
  const exitAt = new Array<number>(n);
  t = s6End;
  exitOrder.forEach((vi, k) => {
    if (k > 0) t += jitter(cfg.exitGap, cfg.gapJitter);
    exitAt[vi] = t;
  });
  const total = Math.max(...exitAt) + cfg.exitTail;

  return {
    cfg,
    total,
    sections: [
      { name: "登場", side: "右脳優位", start: 0, end: s1End },
      { name: "滞在", side: "右脳優位", start: s1End, end: s2End },
      { name: "PAN →左脳へ", side: "移行中", start: s2End, end: s3End },
      { name: "滞在", side: "左脳優位", start: s3End, end: s4End },
      { name: "PAN →右脳へ", side: "移行中", start: s4End, end: s5End },
      { name: "滞在", side: "右脳優位", start: s5End, end: s6End },
      { name: "退場", side: "右脳優位", start: s6End, end: total },
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

export function startMedSession(cfg: MedConfig, timeline?: MedTimeline): MedSession {
  const tl = timeline ?? buildTimeline(cfg);
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  ctx.resume();

  const t0 = ctx.currentTime + 0.3;
  const end = t0 + tl.total;

  const merger = ctx.createChannelMerger(2);
  const breath = ctx.createGain(); // 呼吸スウェル（両chに同じ波 → 耳間バランスは崩れない）
  breath.gain.value = 1;
  const master = ctx.createGain();
  master.gain.value = cfg.master;
  merger.connect(breath);
  breath.connect(master);
  master.connect(ctx.destination);

  // ---- 呼吸スウェル: 周期12秒(5呼吸/分)・吸う4割/吐く6割の非対称波。
  //      音が満ちてくる=吸う、長く引いていく=吐く。全区間ぶんを一度に予約 ----
  if (cfg.breathDepth > 0) {
    const P = cfg.breathPeriod;
    const RISE = 0.4;
    const sr = 4; // 4点/秒（線形補間で十分なめらか）
    const n = Math.ceil((tl.total + 2) * sr);
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const ph = (i / sr / P) % 1;
      const x = ph < RISE ? ph / RISE : 1 - (ph - RISE) / (1 - RISE); // 三角 0→1→0
      const s = 0.5 - 0.5 * Math.cos(Math.PI * x); // 角を丸める
      curve[i] = 1 - cfg.breathDepth + cfg.breathDepth * s;
    }
    breath.gain.setValueAtTime(curve[0], t0 - 0.1);
    breath.gain.setValueCurveAtTime(curve, t0, tl.total + 2);
  }

  // ---- 同相AM補強（アイソクロニック）: 両耳同相・極浅の Δf Hz 振幅変調。
  //      聴性定常応答はバイノーラルより同相AMのほうが強い。全発振器と同時startなので
  //      バイノーラルのうなりと位相の揃った 8.02Hz 二重ドライブになる ----
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

  // Δf は1本の信号線から全 Hi 発振器へ配る（将来Δfを時間変化させるときは offset 1箇所を書き換える）
  const dfSrc = ctx.createConstantSource();
  dfSrc.offset.value = cfg.deltaF;
  dfSrc.start(t0);
  dfSrc.stop(end + 1);

  const stoppables: { stop: (t: number) => void }[] = [dfSrc];

  for (const vt of tl.voices) {
    const { spec } = vt;
    const f = spec.freq;

    // ---- キャリア2本（Lo/Hi）。同一時刻 start で全8本のうなり位相が揃う ----
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

    // ---- 音量ゆらぎ ----
    // 共通成分(75%): R, R·φ, R·φ² を 1 : 1/φ : 1/φ² で合成し、両耳に同じ波を配る。
    // 無理数比なので二度と同じ形に戻らない。両耳が同じに揺れる＝耳間バランスが
    // 保たれ、バイノーラルのうなりが痩せない（ここが仕様書からの改良点）
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
      stoppables.push(lfo);
      commonFlutter.push(lg);
    });

    // ---- 耳ごとのゲイン（基本音量 + 音量ゆらぎ）と包絡（登場/PAN/退場） ----
    const buildEar = (lr: 0 | 1) => {
      const ear = ctx.createGain();
      ear.gain.value = spec.vol;
      commonFlutter.forEach((lg) => lg.connect(ear.gain));
      // 独立成分(25%): 左右で速度を φ^0.11 ずらした1本だけ。完全同期を避けて有機感を残す
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = spec.rate * Math.sqrt(PHI) * (lr === 1 ? Math.pow(PHI, 0.11) : 1);
      const lg = ctx.createGain();
      lg.gain.value = spec.vol * cfg.flutterDepth * 0.25;
      lfo.connect(lg);
      lg.connect(ear.gain);
      lfo.start(t0);
      lfo.stop(end + 1);
      stoppables.push(lfo);
      const env = ctx.createGain();
      env.gain.value = 0.0001;
      ear.connect(env);
      env.connect(merger, 0, lr);
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
      // 登場
      p.setValueCurveAtTime(riseCurve(), t0 + vt.enterAt, cfg.enterRise);
      // PAN×2: 沈み（往復 panDip*2 秒）
      p.setValueCurveAtTime(dipCurve(), t0 + vt.pan1At, cfg.panDip * 2);
      p.setValueCurveAtTime(dipCurve(), t0 + vt.pan2At, cfg.panDip * 2);
      // 退場
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
    stoppables.push(oscLo, oscHi, pitchLfo);
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      window.setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 1000);
    } catch {
      try {
        ctx.close();
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
