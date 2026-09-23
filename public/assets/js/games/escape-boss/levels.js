// 経験値とレベル(Phase 18)。DOM・保存・時計に触れない純粋な計算。
//
// 1 プレイの経験値 = (正解した語数 × 10 + クリア 100 + 新しく解放した実績 1 つにつき 50)× 難易度の倍率(PR 2)。
// レベルは 1〜50。レベル L に上がるのに必要な、累計の経験値は 60 × (L − 1)^1.7(10 の位に丸める)。
// 累計の経験値は、記録の進行状況(progress.exp)に持つ。曲線の値は、あとから直せる(このファイルの定数)。

export const EXP_RULES = Object.freeze({ perWord: 10, clearBonus: 100, perAchievement: 50 });
export const LEVEL_CURVE = Object.freeze({ base: 60, power: 1.7 });
export const MAX_LEVEL = 50;
// 改ざんされた値で、計算が壊れないようにする上限(累計の経験値・1 プレイの語数)
export const MAX_EXP = 100_000_000;
const MAX_WORDS_PER_PLAY = 1000;

const toCount = (value, max) =>
  Number.isFinite(value) && value > 0 ? Math.min(max, Math.floor(value)) : 0;

/** レベル level に上がるのに必要な、累計の経験値(レベル 1 は 0)。範囲外のレベルは、1〜50 に収める */
export function expForLevel(level) {
  const clamped = Math.min(MAX_LEVEL, Math.max(1, Number.isFinite(level) ? Math.floor(level) : 1));
  if (clamped === 1) return 0;
  return Math.round((LEVEL_CURVE.base * (clamped - 1) ** LEVEL_CURVE.power) / 10) * 10;
}

/**
 * 累計の経験値から、レベルと、次のレベルまでの様子を返す。
 * { level, exp, levelStart, nextAt(最高レベルなら null), into, needed, remaining, ratio(0〜1。最高レベルは 1) }
 */
export function levelOf(exp) {
  const total = toCount(exp, MAX_EXP);
  let level = 1;
  while (level < MAX_LEVEL && total >= expForLevel(level + 1)) level += 1;
  const levelStart = expForLevel(level);
  const nextAt = level < MAX_LEVEL ? expForLevel(level + 1) : null;
  return {
    level,
    exp: total,
    levelStart,
    nextAt,
    into: total - levelStart,
    needed: nextAt === null ? 0 : nextAt - levelStart,
    remaining: nextAt === null ? 0 : nextAt - total,
    ratio: nextAt === null ? 1 : (total - levelStart) / (nextAt - levelStart),
  };
}

/**
 * 1 プレイで得る経験値(整数)。result は { status, correct }。
 * newAchievements = このプレイで新しく解放した実績の数、multiplier = 難易度の倍率(既定 1)。
 * 数でない値・負の値は、0 として扱う。
 */
export function expForResult(result, { newAchievements = 0, multiplier = 1 } = {}) {
  const words = toCount(result?.correct, MAX_WORDS_PER_PLAY);
  const clear = result?.status === "cleared" ? EXP_RULES.clearBonus : 0;
  const achievements = toCount(newAchievements, 100) * EXP_RULES.perAchievement;
  const factor = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  return Math.floor((words * EXP_RULES.perWord + clear + achievements) * factor);
}

/** 経験値を足す(上限あり) */
export const addExp = (exp, gain) =>
  Math.min(MAX_EXP, toCount(exp, MAX_EXP) + toCount(gain, MAX_EXP));

/**
 * 以前の記録(経験値を持たない版 1〜3)から、最初の累計の経験値を作る。
 * これまでの累計の正解語数・クリア数・解放済みの実績の数から、上の決めで計算する(以前の記録は、消えず、そのまま数える)。
 */
export function initialExp(progress, achievementCount = 0) {
  const words = toCount(progress?.totalWords, MAX_EXP);
  const clears = toCount(progress?.totalClears, MAX_EXP);
  const achievements = toCount(achievementCount, 1000);
  return Math.min(
    MAX_EXP,
    words * EXP_RULES.perWord +
      clears * EXP_RULES.clearBonus +
      achievements * EXP_RULES.perAchievement,
  );
}

/** レベルが上がったか。上がったなら { from, to }、上がっていなければ null */
export function levelUp(before, after) {
  const from = levelOf(before).level;
  const to = levelOf(after).level;
  return to > from ? { from, to } : null;
}
