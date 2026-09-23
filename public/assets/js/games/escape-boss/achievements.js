// 実績・称号の判定。定義は public/data/achievements.json(名前・説明・条件の種類とパラメータ)。
// 判定は純粋な関数で、何度呼んでも同じ結果になる(解放済みのものは返さない)。
import { clearKey } from "./storage.js";
import { masteryOf } from "./mastery.js";

// 条件の種類ごとの判定。progress は記録後の進行状況、result は直前のプレイ結果。
const CHECKS = {
  role_clear: (params, { progress }) => (progress.clears[params.role] ?? 0) > 0,
  all_roles_clear: (params, { progress }) =>
    params.roles.every((role) => (progress.clears[role] ?? 0) > 0),
  no_miss_clear: (_params, { result }) => result?.status === "cleared" && result.miss === 0,
  close_call: (params, { result }) =>
    result?.status === "cleared" && result.distance <= params.max_distance,
  fast_clear: (params, { result }) => result?.status === "cleared" && result.cps >= params.min_cps,
  all_jobs_clear: (_params, { progress, jobIds }) =>
    jobIds.every((job) => progress.clearedJobs[job] === true),
  total_clears: (params, { progress }) => progress.totalClears >= params.count,
  total_words: (params, { progress }) => progress.totalWords >= params.count,
  // Phase 18 PR 3(隠し実績・実績の種類の追加)。いずれも、既存の result・progress の項目だけで判定する
  // (新しい保存項目は増やさない)。
  difficulty_clear: (params, { result }) =>
    result?.status === "cleared" && result.difficulty === params.difficulty,
  all_roles_clear_difficulty: (params, { progress }) =>
    params.roles.every(
      (role) => (progress.difficultyClears?.[clearKey(role, params.difficulty)] ?? 0) > 0,
    ),
  best_streak: (params, { result }) => (result?.streak ?? 0) >= params.count,
  job_mastery: (params, { progress, jobIds }) =>
    jobIds.some((id) => masteryOf(progress.jobs?.[id]).rank >= params.rank),
};

export const ACHIEVEMENT_KINDS = Object.keys(CHECKS);

/**
 * 新しく解放された実績の id を返す。
 * unlocked: 解放済みの { id: 日時 }、progress: 記録後の進行状況、result: 直前の結果、jobIds: 全職種の id
 */
export function evaluateAchievements({ definitions, unlocked, progress, result, jobIds }) {
  return definitions
    .filter((definition) => !(definition.id in unlocked))
    .filter((definition) => {
      const check = CHECKS[definition.kind];
      return check ? check(definition.params ?? {}, { progress, result, jobIds }) : false;
    })
    .map((definition) => definition.id);
}

// 選べる称号(既定の称号 + 解放済みの実績に付く称号)。id は既定なら "newbie"、それ以外は実績の id。
export function availableTitles(config, unlocked) {
  const earned = config.achievements
    .filter((definition) => definition.title && definition.id in unlocked)
    .map((definition) => ({ id: definition.id, name: definition.title }));
  return [config.default_title, ...earned];
}

export function titleName(config, titleId) {
  const found = [
    config.default_title,
    ...config.achievements.map((a) => ({ id: a.id, name: a.title })),
  ].find((title) => title.id === titleId && title.name);
  return found ? found.name : config.default_title.name;
}
