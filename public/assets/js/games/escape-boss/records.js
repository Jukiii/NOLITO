// 記録(プレイ結果・ランキング・進行状況・プロフィール)の更新。保存内容 data を受け取り、新しい data を返す純粋な関数。
import { MAX_RANKING, MAX_RESULTS, DEFAULT_TITLE_ID, sanitizeNickname } from "./storage.js";

const bump = (map, key) => ({ ...map, [key]: (map[key] ?? 0) + 1 });

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
  const progress = {
    ...data.progress,
    totalWords: data.progress.totalWords + result.correct,
  };
  if (cleared) {
    progress.totalClears += 1;
    progress.clears = bump(progress.clears, result.roleId);
    progress.clearedJobs = { ...progress.clearedJobs, [result.jobId]: true };
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
