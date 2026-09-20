-- 問い合わせ(Phase 10 PR 3)。時刻は、UNIX 時間(秒)。
-- 個人情報: message(本文に、書かれた内容)・email(返信用。任意)・env_info(環境の情報。利用者が添付を選んだときだけ)。
-- 対応が終わったもの(status = 'done')は、終わってから 6 か月で、運営者が削除する(docs/contact-setup.md)。
-- 誰の問い合わせかを示す user_id は、持たない(アカウントには、結びつけない)。
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
CREATE INDEX inquiries_status ON inquiries(status, created_at);
