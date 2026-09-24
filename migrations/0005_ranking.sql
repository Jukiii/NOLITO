-- オンラインランキング(Phase 19 PR 3)。任意(既定は不参加。ranking_opt_in = 0)。
-- 不参加にすると、この利用者の ranking_entries は、サーバー側からもすぐに削除する(deleteRankingEntries)。
-- 1 利用者 × 役職 × 難易度で 1 行(職種をまたいだ自己ベスト。成績ページの「ハイスコア」と同じ考え方)。
ALTER TABLE users ADD COLUMN ranking_opt_in INTEGER NOT NULL DEFAULT 0;
CREATE TABLE ranking_entries (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL,
  difficulty_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, role_id, difficulty_id)
);
CREATE INDEX ranking_entries_lookup ON ranking_entries(role_id, difficulty_id, score DESC, achieved_at ASC);
