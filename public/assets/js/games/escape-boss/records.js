// 記録(プレイ結果・ランキング・進行状況・プロフィール)の更新。保存内容 data を受け取り、新しい data を返す純粋な関数。
import { DEFAULT_DIFFICULTY } from "./difficulty.js";
import { addExp, expForResult, levelUp as levelUpOf } from "./levels.js";
import {
  MAX_RANKING,
  MAX_RESULTS,
  DEFAULT_TITLE_ID,
  bestKey,
  clearKey,
  sanitizeNickname,
} from "./storage.js";

const bump = (map, key) => ({ ...map, [key]: (map[key] ?? 0) + 1 });

// 職種ごとの合計(plays・clears・words・hits・miss)に、1 プレイ分を足す
function bumpJobStats(jobs, result) {
  const current = jobs[result.jobId] ?? { plays: 0, clears: 0, words: 0, hits: 0, miss: 0 };
  return {
    ...jobs,
    [result.jobId]: {
      plays: current.plays + 1,
      clears: current.clears + (result.status === "cleared" ? 1 : 0),
      words: current.words + result.correct,
      hits: current.hits + result.hits,
      miss: current.miss + result.miss,
    },
  };
}

// 自己ベスト(職種 × 役職 × 難易度)を、スコアが上回ったときだけ、更新する
function recordBest(bests, result, difficulty) {
  const key = bestKey(result.jobId, result.roleId, difficulty);
  const current = bests[key];
  if (current && current.score >= result.score) return bests;
  return { ...bests, [key]: { score: result.score, playedAt: result.playedAt } };
}

// 同点は先に記録したほうを上位にする
function sortRanking(a, b) {
  return b.score - a.score || a.playedAt - b.playedAt;
}

/**
 * プレイ結果を記録する。result は { playedAt, jobId, roleId, status, score, correct, miss, hits, elapsed,
 * distance, accuracy, cps, vocabularyVersion }。クリアした記録だけがランキングに載る。
 * titleName は、ランキングに表示する称号名。rank は載った順位(圏外・ゲームオーバーは null)。
 */
export function recordResult(data, result, { titleName = "" } = {}) {
  const cleared = result.status === "cleared";
  const difficulty = result.difficulty ?? DEFAULT_DIFFICULTY;
  const progress = {
    ...data.progress,
    totalWords: data.progress.totalWords + result.correct,
    jobs: bumpJobStats(data.progress.jobs, result),
  };
  if (cleared) {
    progress.totalClears += 1;
    progress.clears = bump(progress.clears, result.roleId);
    progress.clearedJobs = { ...progress.clearedJobs, [result.jobId]: true };
    progress.difficultyClears = bump(
      progress.difficultyClears,
      clearKey(result.roleId, difficulty),
    );
    progress.bests = recordBest(progress.bests, result, difficulty);
  }

  let rankings = data.rankings;
  let rank = null;
  if (cleared) {
    const entry = {
      score: result.score,
      playedAt: result.playedAt,
      jobId: result.jobId,
      roleId: result.roleId,
      nickname: data.profile.nickname,
      title: titleName,
    };
    const sorted = [...(rankings[result.roleId] ?? []), entry].sort(sortRanking);
    const position = sorted.indexOf(entry) + 1;
    rank = position <= MAX_RANKING ? position : null;
    rankings = { ...rankings, [result.roleId]: sorted.slice(0, MAX_RANKING) };
  }

  return {
    data: {
      ...data,
      results: [result, ...data.results].slice(0, MAX_RESULTS),
      rankings,
      progress,
    },
    rank,
  };
}

/**
 * 1 プレイ分の経験値を、進行状況に足す(recordResult のあと、実績の判定を終えてから呼ぶ)。
 * options は expForResult に渡す({ newAchievements, multiplier })。
 * 戻り値: { progress(新しい進行状況), gained(このプレイで得た経験値), levelUp(上がった場合 { from, to }、それ以外 null) }
 */
export function grantExp(progress, result, options = {}) {
  const gained = expForResult(result, options);
  const before = progress.exp;
  const exp = addExp(before, gained);
  return { progress: { ...progress, exp }, gained, levelUp: levelUpOf(before, exp) };
}

// 役職に挑戦できるか。unlock がない役職は最初から挑戦できる。
export function isRoleUnlocked(data, role) {
  if (!role.unlock) return true;
  if (role.unlock.type === "clear_roles") {
    return role.unlock.roles.every((id) => (data.progress.clears[id] ?? 0) > 0);
  }
  return false;
}

export function getRanking(data, roleId) {
  return data.rankings[roleId] ?? [];
}

// 新しく解放された実績を記録する(すでに解放済みのものは日時を変えない)
export function unlockAchievements(data, ids, at) {
  if (ids.length === 0) return data;
  const achievements = { ...data.achievements };
  for (const id of ids) achievements[id] ??= at;
  return { ...data, achievements };
}

/**
 * プロフィールを更新する。availableTitleIds に含まれない称号は選べない(既定の称号に戻す)。
 */
export function updateProfile(data, { nickname, titleId }, availableTitleIds) {
  return {
    ...data,
    profile: {
      nickname: sanitizeNickname(nickname ?? data.profile.nickname),
      titleId: availableTitleIds.includes(titleId) ? titleId : DEFAULT_TITLE_ID,
    },
  };
}
