-- 管理画面の監査ログ(Phase 26 PR 1)。変更前後(before_json/after_json)を記録できる、既存の audit_log
-- (ログイン等の短い出来事だけ)とは別のテーブル。書き込みは functions/_lib/admin-audit.js から行う。
-- before_json/after_json に、メールアドレスなどの個人情報を、そのまま書き込まないこと(0051決定ログ)。
CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);
CREATE INDEX admin_audit_log_at ON admin_audit_log(at);
CREATE INDEX admin_audit_log_resource ON admin_audit_log(resource_type, resource_id);
