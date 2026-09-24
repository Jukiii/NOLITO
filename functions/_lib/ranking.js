// オンラインランキング(Phase 19 PR 3)の読み書き。ranking_entries は、1 利用者 × 役職 × 難易度で
// 1 行(職種をまたいだ自己ベスト。成績ページの「ハイスコア」と同じ考え方)。個人を特定する情報
// (メールアドレス・アカウントの ID)は、読み出しに含めない(ニックネーム・称号・スコアだけ)。
export const MAX_RANKING = 10;

const toEntry = (row) => ({
  nickname: row.nickname,
  title: row.title,
  jobId: row.job_id,
  score: row.score,
  achievedAt: row.achieved_at,
});

/** 役職 × 難易度の、上位(MAX_RANKING件)。個人を特定する情報は含まない。 */
export async function getRankingEntries(db, roleId, difficultyId) {
  const { results } = await db
    .prepare(
      `SELECT nickname, title, job_id, score, achieved_at FROM ranking_entries
       WHERE role_id = ? AND difficulty_id = ?
       ORDER BY score DESC, achieved_at ASC LIMIT ?`,
    )
    .bind(roleId, difficultyId, MAX_RANKING)
    .all();
  return results.map(toEntry);
}

/**
 * 記録を送る(いまの自己ベストより上のときだけ、置き換える)。呼び出し側で、スコアの妥当性・
 * 難易度が対象か・参加しているかを、確認してから呼ぶこと(このモジュールは、検証をしない)。
 */
export async function saveRankingEntry(db, userId, entry, now) {
  await db
    .prepare(
      `INSERT INTO ranking_entries
        (user_id, role_id, difficulty_id, job_id, nickname, title, score, achieved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, role_id, difficulty_id) DO UPDATE SET
         job_id = excluded.job_id, nickname = excluded.nickname, title = excluded.title,
         score = excluded.score, achieved_at = excluded.achieved_at
       WHERE excluded.score > ranking_entries.score`,
    )
    .bind(
      userId,
      entry.roleId,
      entry.difficultyId,
      entry.jobId,
      entry.nickname,
      entry.title,
      entry.score,
      now,
    )
    .run();
}
