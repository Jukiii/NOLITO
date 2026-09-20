-- ライセンスキー(Phase 9 PR 2)。時刻は、UNIX 時間(秒)。
-- キーそのものは保存しない。SHA-256 のハッシュ(key_hash)と、見分けるための末尾 4 文字(key_hint)だけ。
-- user_id が NULL のものは、まだ誰にも登録されていない(または、登録したアカウントが削除された)キー。
-- アカウントを削除すると、結びつきだけが外れ(redeemed_at も NULL)、同じキーを、また登録できる。
CREATE TABLE licenses (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  product_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  issued_at INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX licenses_user ON licenses(user_id);
