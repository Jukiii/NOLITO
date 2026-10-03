// 記事の D1 での保存(Issue #195)。1行 = 1記事(本文は Markdown のまま)。
// 公開の一覧(functions/api/articles.js)と、管理画面のAPIが使う。下書き(draft)は、公開の一覧に出さない。

const META = "slug, title, description, date, updated, tags, draft";

const toMeta = (row) => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  date: row.date,
  updated: row.updated ?? null,
  tags: JSON.parse(row.tags),
  draft: row.draft === 1,
});

/** 本文を除いた一覧(新しい順。同じ日付ならスラッグ順)。publishedOnly なら、下書きを除く。 */
export async function listArticles(db, { publishedOnly = false } = {}) {
  const where = publishedOnly ? "WHERE draft = 0" : "";
  const { results } = await db
    .prepare(`SELECT ${META} FROM articles ${where} ORDER BY date DESC, slug ASC`)
    .all();
  return results.map(toMeta);
}

/** 1件(本文つき。なければ null)。 */
export async function getArticle(db, slug) {
  const row = await db
    .prepare(`SELECT ${META}, body FROM articles WHERE slug = ?`)
    .bind(slug)
    .first();
  return row ? { ...toMeta(row), body: row.body } : null;
}

export async function insertArticle(db, article, now) {
  await db
    .prepare(
      "INSERT INTO articles (slug, title, description, date, updated, tags, draft, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      article.slug,
      article.title,
      article.description,
      article.date,
      article.updated,
      JSON.stringify(article.tags),
      article.draft ? 1 : 0,
      article.body,
      now,
      now,
    )
    .run();
}

/** 既存の1件の内容を差し替える(slug・created_at は変えない)。 */
export async function updateArticle(db, article, now) {
  await db
    .prepare(
      "UPDATE articles SET title = ?, description = ?, date = ?, updated = ?, tags = ?, draft = ?, body = ?, updated_at = ? WHERE slug = ?",
    )
    .bind(
      article.title,
      article.description,
      article.date,
      article.updated,
      JSON.stringify(article.tags),
      article.draft ? 1 : 0,
      article.body,
      now,
      article.slug,
    )
    .run();
}

export async function deleteArticle(db, slug) {
  await db.prepare("DELETE FROM articles WHERE slug = ?").bind(slug).run();
}

/** 公開の一覧の形(public/data/articles.json と同じ { articles: [...] })。 */
export async function assemblePublicArticles(db) {
  const articles = await listArticles(db, { publishedOnly: true });
  return {
    articles: articles.map(({ slug, title, description, date, updated, tags }) => ({
      slug,
      title,
      description,
      date,
      updated,
      tags,
      url: `/articles/${slug}/`,
    })),
  };
}
