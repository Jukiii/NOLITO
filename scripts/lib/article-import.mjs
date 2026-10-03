// 記事の原稿(content/articles/*.md)を、D1 の articles に取り込む SQL を作る(運営者用。ファイル・通信に触れない)。
// すでにある記事(同じスラッグ)は、上書きしない(管理画面で直した内容を、消さないため)。
import { splitFrontmatter, validateArticle } from "./frontmatter.mjs";

/** SQL の文字列リテラル(単引用符を二重にする)。NUL 文字は D1 が扱えないので、断る。 */
export function sqlString(value) {
  const text = String(value);
  if (text.includes(String.fromCodePoint(0))) throw new Error("NUL 文字は、取り込めません。");
  return `'${text.replaceAll("'", "''")}'`;
}

/** 原稿 [{ slug, text }] を検証して、取り込む記事の一覧(下書きも含む)にする。問題は、まとめて Error にする。 */
export function parseSources(sources) {
  const problems = [];
  const articles = [];
  for (const { slug, text } of sources) {
    try {
      const { data, body } = splitFrontmatter(text);
      articles.push({ ...validateArticle(data, slug), body });
    } catch (error) {
      problems.push(`content/articles/${slug}.md\n  ${error.message.split("\n").join("\n  ")}`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n\n"));
  return articles;
}

/** 1 記事の INSERT。同じスラッグがあれば、何もしない。 */
export function insertSql(article, now) {
  const values = [
    sqlString(article.slug),
    sqlString(article.title),
    sqlString(article.description),
    sqlString(article.date),
    article.updated === null ? "NULL" : sqlString(article.updated),
    sqlString(JSON.stringify(article.tags)),
    article.draft ? "1" : "0",
    sqlString(article.body),
    String(now),
    String(now),
  ];
  return `INSERT INTO articles (slug, title, description, date, updated, tags, draft, body, created_at, updated_at) VALUES (${values.join(", ")}) ON CONFLICT(slug) DO NOTHING;`;
}

/** 取り込む SQL 全体(1 記事 1 文)。 */
export function importSql(articles, now) {
  return `${articles.map((article) => insertSql(article, now)).join("\n")}\n`;
}

/** 取り込みの計画: すでに D1 にあるスラッグを除いた一覧と、飛ばす一覧。 */
export function planImport(articles, existingSlugs) {
  const existing = new Set(existingSlugs);
  return {
    toInsert: articles.filter((article) => !existing.has(article.slug)),
    skipped: articles.filter((article) => existing.has(article.slug)),
  };
}
