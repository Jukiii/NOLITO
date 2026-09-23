// 難易度(Phase 18)。DOM・保存に触れない。やさしい(easy)= 練習 / ふつう(normal)= これまでどおり(既定)/
// むずかしい(hard)。中身(倍率・解放の条件)は `public/data/difficulties.json`(データで決める。役職の `roles.json` と同じ考え)。

export const DIFFICULTY_IDS = Object.freeze(["easy", "normal", "hard"]);
export const DEFAULT_DIFFICULTY = "normal";
// 練習の難易度(ランキング・役職クリアの実績・会長の解放に、数えない)
export const PRACTICE_DIFFICULTY = "easy";

/** 決まった難易度の ID か(__proto__ などの名前・文字でない値は、false) */
export const isDifficulty = (value) => typeof value === "string" && DIFFICULTY_IDS.includes(value);

// 倍率・経験値の倍率・解放の種類の、使ってよい範囲(改ざん・書き間違いに備える)
const MODIFIER_RANGE = [0.3, 3];
const EXP_MULTIPLIER_RANGE = [0.1, 5];
const UNLOCK_TYPES = Object.freeze(["role_clear_normal"]);

const inRange = (value, [min, max]) => typeof value === "number" && value >= min && value <= max;

/**
 * difficulties.json の 1 件を検証して、整える。おかしければ null(その難易度は、使えないものとして無視する)。
 * 知らない項目は、捨てる(入力を書き換えない)。
 */
export function normalizeDifficulty(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  if (!isDifficulty(raw.id)) return null;
  if (typeof raw.name !== "string" || raw.name.length === 0 || raw.name.length > 20) return null;
  if (
    typeof raw.description !== "string" ||
    raw.description.length === 0 ||
    raw.description.length > 200
  ) {
    return null;
  }
  if (typeof raw.rankable !== "boolean") return null;
  if (raw.unlock !== null && !UNLOCK_TYPES.includes(raw.unlock)) return null;
  if (!inRange(raw.exp_multiplier, EXP_MULTIPLIER_RANGE)) return null;
  const modifiers = raw.modifiers;
  if (typeof modifiers !== "object" || modifiers === null) return null;
  for (const key of ["drain", "gain", "initial"]) {
    if (!inRange(modifiers[key], MODIFIER_RANGE)) return null;
  }
  return Object.freeze({
    id: raw.id,
    name: raw.name,
    description: raw.description,
    rankable: raw.rankable,
    unlock: raw.unlock,
    exp_multiplier: raw.exp_multiplier,
    modifiers: Object.freeze({
      drain: modifiers.drain,
      gain: modifiers.gain,
      initial: modifiers.initial,
    }),
  });
}

/** difficulties.json の配列を検証する(無効な項目・同じ id の 2 件目は、捨てる)。読み込みに使う */
export function normalizeDifficulties(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const list = [];
  for (const item of raw) {
    const difficulty = normalizeDifficulty(item);
    if (difficulty && !seen.has(difficulty.id)) {
      seen.add(difficulty.id);
      list.push(difficulty);
    }
  }
  return list;
}

/**
 * 役職の stage に、難易度の倍率をかけた、新しい stage を作る(元の stage は書き換えない)。
 * 変わるのは、正解で増える距離の分(base_gain・gain_per_char)・時間で縮む速さ(drain_per_second)・
 * 初期距離(initial_distance。最大距離を超えない)だけ。難易度の分・速さの分・特殊ルール・語の重み・目標語数は、変わらない。
 */
export function applyDifficulty(stage, difficulty) {
  const modifiers = difficulty?.modifiers;
  if (!modifiers) return stage;
  return {
    ...stage,
    base_gain: stage.base_gain * modifiers.gain,
    gain_per_char: stage.gain_per_char * modifiers.gain,
    drain_per_second: stage.drain_per_second * modifiers.drain,
    initial_distance: Math.min(stage.max_distance, stage.initial_distance * modifiers.initial),
  };
}

/**
 * 難易度に、いま挑戦できるか。role_clear_normal は、その役職を「ふつう」で、1 回以上クリアしていること。
 * difficultyClears は、進行状況の progress.difficultyClears({ "役職:難易度": 回数 })。clearKey で、鍵を作る。
 */
export function isDifficultyUnlocked(difficulty, { difficultyClears, roleId, clearKey }) {
  if (!difficulty?.unlock) return true;
  if (difficulty.unlock === "role_clear_normal") {
    return (difficultyClears?.[clearKey(roleId, DEFAULT_DIFFICULTY)] ?? 0) > 0;
  }
  return false;
}
