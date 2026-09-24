-- サイト全体の見た目の設定(テーマ・文字サイズ・アニメーション軽減)の、アカウントへの同期(Phase 21 PR 3)。
-- 任意(強制しない)。アカウントごとに、この上書き1件だけ持つ(game_progress と同じ形)。時刻は、UNIX 時間(秒)。
CREATE TABLE site_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  font_size TEXT NOT NULL,
  reduced_motion TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
