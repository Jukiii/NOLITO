PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_init.sql','2026-09-20 08:25:16');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_licenses.sql','2026-09-20 08:25:16');
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
);
INSERT INTO "users" ("id","google_sub","email","nickname","created_at","last_login_at") VALUES('u1','sub-1','alice@example.com','たろう''s',1000,2000);
INSERT INTO "users" ("id","google_sub","email","nickname","created_at","last_login_at") VALUES('u2','sub-2','bob@example.com','bob',1000,2000);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
INSERT INTO "sessions" ("token_hash","user_id","created_at","last_seen_at") VALUES('hash1','u1',1000,2000);
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
INSERT INTO "audit_log" ("id","at","user_id","event","detail") VALUES(1,1000,'u1','login','');
INSERT INTO "audit_log" ("id","at","user_id","event","detail") VALUES(2,1001,NULL,'account-delete','line1 with ; semicolon');
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
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
INSERT INTO "licenses" ("id","key_hash","key_hint","product_id","note","issued_at","user_id","redeemed_at","revoked_at") VALUES('l1','kh1','ABCD','kii-michi','memo',1000,'u1',1500,NULL);
INSERT INTO "licenses" ("id","key_hash","key_hint","product_id","note","issued_at","user_id","redeemed_at","revoked_at") VALUES('l2','kh2','WXYZ','escape-boss','',1000,NULL,NULL,NULL);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',2);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('audit_log',2);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX audit_log_at ON audit_log(at);
CREATE INDEX licenses_user ON licenses(user_id);