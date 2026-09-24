// ゲーム「上司から逃げろ」の記録の、アカウントへの同期(Phase 19 PR 2)。任意(強制しない)。
// 1プレイごとの詳細な記録(結果の履歴・キーごとの集計など)は、扱わない(端末にとどめる)。
// 検証は、クライアント側(public/assets/js/games/escape-boss/storage.js)の normalizeSyncProgress を
// そのまま使う(検証・移行のしくみを重複させない。同じファイルの migrateRankingKey などと同じ考え)。
import { normalizeSyncProgress } from "../../public/assets/js/games/escape-boss/storage.js";

// jobs・difficultyClears・bests・achievements を含めても、十分な余裕を持たせた上限
export const MAX_BODY_BYTES = 32 * 1024;

const toProgress = (row) =>
  row && {
    nickname: row.nickname,
    titleId: row.title_id,
    totalClears: row.total_clears,
    totalWords: row.total_words,
    clears: JSON.parse(row.clears),
    clearedJobs: JSON.parse(row.cleared_jobs),
    exp: row.exp,
    jobs: JSON.parse(row.jobs),
    difficultyClears: JSON.parse(row.difficulty_clears),
    bests: JSON.parse(row.bests),
    achievements: JSON.parse(row.achievements),
    updatedAt: row.updated_at,
  };

/** アカウントに保存されている、記録の要約。まだ同期していなければ null。 */
export async function getSyncedProgress(db, userId) {
  const row = await db
    .prepare("SELECT * FROM game_progress WHERE user_id = ?")
    .bind(userId)
    .first();
  return toProgress(row);
}

/**
 * 記録の要約を、検証してから保存する(すでにあれば、まるごと置き換える)。
 * raw が正しい形でなければ null(呼び出し側で 400 にする)。
 */
export async function saveSyncedProgress(db, userId, raw, now) {
  const progress = normalizeSyncProgress(raw);
  if (!progress) return null;
  await db
    .prepare(
      `INSERT INTO game_progress
        (user_id, nickname, title_id, total_clears, total_words, clears, cleared_jobs,
         exp, jobs, difficulty_clears, bests, achievements, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         nickname = excluded.nickname, title_id = excluded.title_id,
         total_clears = excluded.total_clears, total_words = excluded.total_words,
         clears = excluded.clears, cleared_jobs = excluded.cleared_jobs, exp = excluded.exp,
         jobs = excluded.jobs, difficulty_clears = excluded.difficulty_clears,
         bests = excluded.bests, achievements = excluded.achievements, updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      progress.nickname,
      progress.titleId,
      progress.totalClears,
      progress.totalWords,
      JSON.stringify(progress.clears),
      JSON.stringify(progress.clearedJobs),
      progress.exp,
      JSON.stringify(progress.jobs),
      JSON.stringify(progress.difficultyClears),
      JSON.stringify(progress.bests),
      JSON.stringify(progress.achievements),
      now,
    )
    .run();
  return { ...progress, updatedAt: now };
}
