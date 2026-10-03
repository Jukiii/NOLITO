-- 記事(Issue #195 / Phase 26)。1行 = 1記事。本文は Markdown のまま持つ(公開の HTML への変換は、表示のときに行う)。
-- draft = 1 の下書きは、公開の API に出さない。tags は JSON の配列。日付は YYYY-MM-DD。
CREATE TABLE articles (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  date TEXT NOT NULL,
  updated TEXT,
  tags TEXT NOT NULL,
  draft INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
