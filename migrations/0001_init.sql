-- NOLITO のアカウント(Phase 9)。Cloudflare D1(SQLite)。
-- 時刻は、すべて UNIX 時間(秒)。
-- 個人情報: users の google_sub(Google のアカウント ID)・email・nickname。ほかのテーブルには、個人を特定する情報を入れない。

-- 利用者。Google の sub(変わらない ID)で識別する。メールアドレスは、変わりうるので、識別には使わない。
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);

-- ログインの状態。トークンそのものではなく、SHA-256 のハッシュだけを保存する(漏れても、なりすませない)。
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

-- 監査ログ(ログイン・ログアウト・アカウントの削除など)。個人を特定する情報は入れない。
-- アカウントを削除すると、user_id は NULL になる(匿名になる)。
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_at ON audit_log(at);

-- 回数の制限。key は、IP アドレスなどを、秘密の鍵でハッシュしたもの(元の値は入れない)。
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
