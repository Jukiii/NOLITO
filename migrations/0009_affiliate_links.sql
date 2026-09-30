-- アフィリエイト・広告のリンク情報(Phase 29 PR3)。1行 = 1リンク(affiliates.json の links の1件と同じ形をJSONで持つ)。
-- 公開の一覧(functions/api/affiliates.js)は、このテーブルから組み立てる。管理画面のAPIも、ここを使う。
-- 最初は空(リンクを公開するのは、契約・審査・ポリシーの版を上げたあと。Issue #122・#123)。
CREATE TABLE affiliate_links (
  id TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
