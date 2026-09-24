PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_init.sql','2026-09-20 11:28:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_licenses.sql','2026-09-20 11:28:50');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_inquiries.sql','2026-09-20 11:28:51');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0004_game_sync.sql','2026-09-24 09:00:00');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(5,'0005_ranking.sql','2026-09-24 10:00:00');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(6,'0006_site_settings.sql','2026-09-24 11:00:00');
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_login_at INTEGER NOT NULL
  , ranking_opt_in INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "users" ("id","google_sub","email","nickname","created_at","last_login_at","ranking_opt_in") VALUES('u1','sub-1','alice@example.com','たろう''s',1000,2000,1);
INSERT INTO "users" ("id","google_sub","email","nickname","created_at","last_login_at","ranking_opt_in") VALUES('u2','sub-2','bob@example.com','bob',1000,2000,0);
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
CREATE TABLE inquiries (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  product_id TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  env_info TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  resolved_at INTEGER
);
INSERT INTO "inquiries" ("id","created_at","category","product_id","message","email","env_info","status","resolved_at") VALUES('q1',1000,'bug','kii-michi','sample message','reporter@example.com','viewport=375x800; language=ja','new',NULL);
INSERT INTO "inquiries" ("id","created_at","category","product_id","message","email","env_info","status","resolved_at") VALUES('q2',1001,'question','','done one; with semicolon','','','done',2000);
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
INSERT INTO "game_progress" ("user_id","nickname","title_id","total_clears","total_words","clears","cleared_jobs","exp","jobs","difficulty_clears","bests","achievements","updated_at") VALUES('u1','たろう''s','newbie',3,40,'{"senpai":2}','{"engineer":true}',500,'{"engineer":{"plays":5,"clears":2,"words":40,"hits":100,"miss":5}}','{"senpai:normal":2}','{"engineer:senpai:normal":{"score":1500,"playedAt":1}}','{"clear-senpai":100}',2000);
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
INSERT INTO "ranking_entries" ("user_id","role_id","difficulty_id","job_id","nickname","title","score","achieved_at") VALUES('u1','senpai','normal','engineer','たろう''s','先輩超え',1500,2000);
CREATE TABLE site_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL,
  font_size TEXT NOT NULL,
  reduced_motion TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO "site_settings" ("user_id","theme","font_size","reduced_motion","updated_at") VALUES('u1','dark','large','system',2000);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',6);
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('audit_log',2);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX audit_log_at ON audit_log(at);
CREATE INDEX licenses_user ON licenses(user_id);
CREATE INDEX inquiries_status ON inquiries(status, created_at);
CREATE INDEX ranking_entries_lookup ON ranking_entries(role_id, difficulty_id, score DESC, achieved_at ASC);