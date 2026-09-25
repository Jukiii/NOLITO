// 音の中身と、音の設定の決まり(Phase 16 PR 3)。DOM・Web Audio・保存に触れない純粋なデータと計算。
// 音は、ファイルを使わず、ブラウザの中で合成する(audio.js が鳴らす)。音の素材の権利・通信は、要らない。

// 音の設定。off = なし(既定)/ se = 効果音だけ / all = 効果音 + BGM
export const SOUND_MODES = Object.freeze(["off", "se", "all"]);
export const DEFAULT_SOUND_MODE = "off";
export const isSoundMode = (value) => SOUND_MODES.includes(value);

// 音量(0〜100 の整数)
export const DEFAULT_VOLUME = 50;
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

/** 音量を、0〜100 の整数にする。数でない・範囲外・小数は、丸めて範囲内に。不正なら既定 */
export function normalizeVolume(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(MAX_VOLUME, Math.max(MIN_VOLUME, Math.round(value)));
}

/** 音量(0〜100)から、全体の大きさ(0〜1)。人の耳に合わせ、2 乗の曲線(小さい側を、細かく) */
export const masterGain = (volume) => (normalizeVolume(volume) / MAX_VOLUME) ** 2;

/** その種類(se = 効果音 / bgm)の音を、いま鳴らしてよいか */
export function isAudible(mode, kind, volume = DEFAULT_VOLUME) {
  if (normalizeVolume(volume) === 0) return false;
  if (mode === "all") return kind === "se" || kind === "bgm";
  if (mode === "se") return kind === "se";
  return false;
}

/** 「音」ボタンで、切り替えたあとの設定(off なら、戻す先。戻す先がなければ all)。off でなければ、off */
export const toggledMode = (mode, restore) =>
  mode === "off" ? (isSoundMode(restore) && restore !== "off" ? restore : "all") : "off";

// 音の 1 つ 1 つ(音符)。at = 始まり(秒)・hz = 高さ・sec = 長さ(秒)・wave = 音色・gain = 大きさ(0〜0.4)・to = 終わりの高さ(すべらせる)
export const WAVES = Object.freeze(["sine", "square", "triangle", "sawtooth"]);
const note = (at, hz, sec, wave, gain, to) =>
  Object.freeze({ at, hz, sec, wave, gain, ...(to ? { to } : {}) });

// 効果音。どれも 1.5 秒以内の、短い電子音
export const SOUND_EFFECTS = Object.freeze({
  // 開始(スタートの合図): 2 つの上がる音
  start: Object.freeze([
    note(0, 523, 0.12, "triangle", 0.3),
    note(0.14, 784, 0.28, "triangle", 0.3),
  ]),
  // 1 語を打ち終えた: 短い、軽い 2 音
  correct: Object.freeze([
    note(0, 659, 0.07, "square", 0.16),
    note(0.07, 880, 0.12, "square", 0.16),
  ]),
  // ミス: 低く、少し下がる音
  miss: Object.freeze([note(0, 196, 0.16, "sawtooth", 0.2, 130)]),
  // 危ない(追いつかれそう): 3 つの警告音
  near: Object.freeze([
    note(0, 880, 0.1, "square", 0.18),
    note(0.16, 660, 0.1, "square", 0.18),
    note(0.32, 880, 0.14, "square", 0.18),
  ]),
  // クリア: 上がっていく 4 音と、長い最後の音
  clear: Object.freeze([
    note(0, 523, 0.14, "triangle", 0.3),
    note(0.14, 659, 0.14, "triangle", 0.3),
    note(0.28, 784, 0.14, "triangle", 0.3),
    note(0.42, 1047, 0.6, "triangle", 0.3),
  ]),
  // ゲームオーバー: 下がっていく 4 音
  over: Object.freeze([
    note(0, 392, 0.2, "sawtooth", 0.2),
    note(0.22, 330, 0.2, "sawtooth", 0.2),
    note(0.44, 262, 0.2, "sawtooth", 0.2),
    note(0.66, 196, 0.5, "sawtooth", 0.2, 165),
  ]),
});
export const EFFECT_NAMES = Object.freeze(Object.keys(SOUND_EFFECTS));

// 音符の高さ(hz・to)だけを、倍率(役職ごとの個性。Phase 23 PR 1)でずらす。音色・長さ・大きさは変えない
const scalePitch = (item, pitch) =>
  pitch === 1
    ? item
    : { ...item, hz: item.hz * pitch, ...(item.to ? { to: item.to * pitch } : {}) };

/** 効果音の音符(知らない名前は、null)。pitch(既定 1)で、役職ごとに高さをずらせる */
export function effectNotes(name, pitch = 1) {
  if (!Object.hasOwn(SOUND_EFFECTS, name)) return null;
  return SOUND_EFFECTS[name].map((item) => scalePitch(item, pitch));
}

// BGM。8 分音符 32 個(4 小節。A マイナー)を、くり返す。低音(三角波)と、メロディー(矩形波。小さく)
export const BGM_BPM = 140;
export const BGM_STEP_SEC = 60 / BGM_BPM / 2;
export const BGM_GAIN = 0.5; // 効果音に対する、BGM の大きさ(効果音を邪魔しない)
const BASS = [
  ...[110, 0, 110, 0, 110, 0, 164.8, 0],
  ...[87.3, 0, 87.3, 0, 87.3, 0, 130.8, 0],
  ...[98, 0, 98, 0, 98, 0, 146.8, 0],
  ...[82.4, 0, 82.4, 0, 82.4, 0, 123.5, 0],
];
const MELODY = [
  ...[440, 0, 523.3, 0, 659.3, 0, 523.3, 0],
  ...[440, 0, 523.3, 0, 698.5, 0, 523.3, 0],
  ...[493.9, 0, 587.3, 0, 784, 0, 587.3, 0],
  ...[659.3, 0, 830.6, 0, 659.3, 0, 493.9, 0],
];
export const BGM_STEPS = BASS.length;

/**
 * BGM の、ある拍(step。何周目でもよい)で鳴らす音符(at は、その拍の始まりからの秒)。
 * pitch(既定 1)で、役職ごとに高さをずらせる(Phase 23 PR 1)。速さ(tempo)は、拍の間隔の側
 * (audio.js が、拍を呼ぶ間隔を調整する)で扱うので、ここでは音の長さ・高さだけを見る。
 * simple(既定 false。低性能な端末向け。Phase 23 PR 3)が true のときは、メロディーを鳴らさず、
 * 低音だけにする(同時に鳴らすオシレーターの数を、最大2つから1つへ減らす)
 */
export function bgmStepNotes(step, pitch = 1, simple = false) {
  if (!Number.isInteger(step) || step < 0) return [];
  const index = step % BGM_STEPS;
  const notes = [];
  if (BASS[index]) notes.push(note(0, BASS[index] * pitch, BGM_STEP_SEC * 1.6, "triangle", 0.3));
  if (!simple && MELODY[index]) {
    notes.push(note(0, MELODY[index] * pitch, BGM_STEP_SEC * 0.9, "square", 0.08));
  }
  return notes;
}
