// 役職ごとの音の個性(Phase 23 PR 1)。DOM・Web Audio に触れない純粋なロジック。
// 役職が進むほど、BGM がわずかに速く・音がわずかに高くなる(0006決定ログの「役職が進むほど難しくなる」に、音でも寄り添う)。
// roles.json の各役職の sound: { tempo, pitch } と対応する。

// 倍率の範囲(不快な速さ・高さにならないよう、控えめな範囲に制限する)
export const MIN_TEMPO = 0.5;
export const MAX_TEMPO = 2;
export const MIN_PITCH = 0.5;
export const MAX_PITCH = 2;

export const DEFAULT_ROLE_SOUND = Object.freeze({ tempo: 1, pitch: 1 });

const inRange = (value, min, max) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

/** 役職の音の倍率。ない・壊れている・範囲外なら、既定(1・1)。 */
export function roleSoundOf(role) {
  const sound = role?.sound;
  const tempo = inRange(sound?.tempo, MIN_TEMPO, MAX_TEMPO)
    ? sound.tempo
    : DEFAULT_ROLE_SOUND.tempo;
  const pitch = inRange(sound?.pitch, MIN_PITCH, MAX_PITCH)
    ? sound.pitch
    : DEFAULT_ROLE_SOUND.pitch;
  return { tempo, pitch };
}

// 「危ない」状態(scene.js の isDanger と同じ判断)のとき、BGM の速さに、追加でかける倍率
export const DANGER_TEMPO_BOOST = 1.15;
