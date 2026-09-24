// オンラインランキング(Phase 19 PR 3)の、送られてきたスコアが「あり得る範囲か」の検査。
// 端末内の記録は改ざんできる(0004決定ログ)ので、公開する値は、サーバー側でも検査する。
// スコアの式は、公開の score.js をそのまま使う(重複させない)。役職の構造(目標語数・最大距離・
// 倍率)だけ、ここに小さく複製する(頻繁には変わらないデータのため。tests/ranking-limits.test.js が、
// 実際の public/data/roles.json と、値がそろっているかを検査する)。
import { SCORE_RULES } from "../../public/assets/js/games/escape-boss/score.js";

// 打鍵/秒の、あり得る上限。実際の人が出せる速さより、十分に大きい値(達人でも、持続では出せない速さ)
export const MAX_CPS = 15;

// 役職ごとの、目標語数・最大距離・スコアの倍率(public/data/roles.json の goal_words・max_distance・
// score_multiplier と同じ値。難易度は、この値を変えない = 上限は、難易度に関係なく同じ)
export const ROLE_LIMITS = Object.freeze({
  senpai: Object.freeze({ goalWords: 14, maxDistance: 100, multiplier: 1 }),
  kakaricho: Object.freeze({ goalWords: 14, maxDistance: 100, multiplier: 1.2 }),
  buchou: Object.freeze({ goalWords: 15, maxDistance: 100, multiplier: 1.5 }),
  shachou: Object.freeze({ goalWords: 15, maxDistance: 100, multiplier: 2 }),
  kaicho: Object.freeze({ goalWords: 16, maxDistance: 100, multiplier: 3 }),
});

// 難易度ごとに、オンラインランキングの対象か(public/data/difficulties.json の rankable と同じ)
export const DIFFICULTY_RANKABLE = Object.freeze({ easy: false, normal: true, hard: true });

// 職種の id(public/data/jobs.json と同じ)。表示にだけ使うが、知らない値は断る
export const JOB_IDS = Object.freeze([
  "engineer",
  "sales",
  "office",
  "food-service",
  "teaching",
  "retail",
]);

export const isKnownRole = (roleId) => Object.hasOwn(ROLE_LIMITS, roleId);
export const isKnownDifficulty = (difficultyId) => Object.hasOwn(DIFFICULTY_RANKABLE, difficultyId);
export const isRankableDifficulty = (difficultyId) => DIFFICULTY_RANKABLE[difficultyId] === true;
export const isKnownJob = (jobId) => JOB_IDS.includes(jobId);

/** その役職で、理論上ありうる最大のスコア(あり得ないほど大きい値は、ここで断る)。 */
export function maxScoreFor(roleId) {
  const role = ROLE_LIMITS[roleId];
  if (!role) return 0;
  const base =
    role.goalWords * SCORE_RULES.perWord +
    SCORE_RULES.clearBonus +
    role.maxDistance * SCORE_RULES.perMeter +
    100 * SCORE_RULES.perAccuracyPercent +
    MAX_CPS * SCORE_RULES.perKeystrokePerSecond;
  return Math.round(base * role.multiplier);
}

/** 送られてきたスコアが、整数で、0 以上、その役職の上限以下か(知らない役職は、常に false)。 */
export function isPlausibleScore(roleId, score) {
  return (
    isKnownRole(roleId) && Number.isInteger(score) && score >= 0 && score <= maxScoreFor(roleId)
  );
}
