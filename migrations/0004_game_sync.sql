-- ゲーム「上司から逃げろ」の記録の、アカウントへの同期(Phase 19 PR 2)。時刻は、UNIX 時間(秒)。
-- 任意(強制しない)。1プレイごとの詳細な記録(結果の履歴・キーごとの集計など)は、送らない。
-- 送るのは「要約」だけ(ニックネーム・称号・経験値・職種ごとの合計・難易度ごとのクリア数・自己ベスト・実績)。
-- JSON の形で保存する(public/assets/js/games/escape-boss/storage.js の normalizeSyncProgress/
-- syncProgressOf/applySyncProgress と、同じ形。アカウントごとに、この上書き1件だけ持つ)。
CREATE TABLE game_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  title_id TEXT NOT NULL DEFAULT 'newbie',
  total_clears INTEGER NOT NULL DEFAULT 0,
  total_words INTEGER NOT NULL DEFAULT 0,
  clears TEXT NOT NULL DEFAULT '{}',
  cleared_jobs TEXT NOT NULL DEFAULT '{}',
  exp INTEGER NOT NULL DEFAULT 0,
  jobs TEXT NOT NULL DEFAULT '{}',
  difficulty_clears TEXT NOT NULL DEFAULT '{}',
  bests TEXT NOT NULL DEFAULT '{}',
  achievements TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);
