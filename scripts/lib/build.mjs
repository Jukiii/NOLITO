// 記事の原稿から、公開するファイルの中身を作る(ファイルの読み書きはしない純粋な処理)と、
// 書き出し・検査(--check)のための入出力。
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { splitFrontmatter, validateArticle } from "./frontmatter.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { renderArticleIndex, renderArticlePage } from "./render.mjs";

/**
 * sources: [{ slug, text }](原稿)。site: { name, url, language }。
 * 戻り値: { files: Map<公開ディレクトリからの相対パス, 中身>, articles: 公開する記事の一覧(新しい順) }
 * 原稿に問題があれば、すべての問題をまとめて Error にして投げる。下書き(draft: true)は公開しない。
 */
export function buildOutputs(sources, site) {
  const siteHost = new URL(site.url).hostname;
  const problems = [];
  const parsed = [];

  for (const { slug, text } of sources) {
    try {
      const { data, body } = splitFrontmatter(text);
      const article = validateArticle(data, slug);
      // 下書きは、本文の変換もせずに読み飛ばす(書きかけで、ビルドを止めないため)
      if (article.draft) continue;
      parsed.push({ article, html: renderMarkdown(body, { siteHost }) });
    } catch (error) {
      problems.push(`content/articles/${slug}.md\n  ${error.message.split("\n").join("\n  ")}`);
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n\n"));

  // 新しい順(同じ日付ならスラッグ順)
  parsed.sort(
    (a, b) =>
      b.article.date.localeCompare(a.article.date) || a.article.slug.localeCompare(b.article.slug),
  );

  const files = new Map();
  for (const { article, html } of parsed) {
    files.set(`articles/${article.slug}/index.html`, renderArticlePage(article, html, site));
  }
  const articles = parsed.map(({ article }) => article);
  files.set("articles/index.html", renderArticleIndex(articles, site));
  files.set(
    "data/articles.json",
    `${JSON.stringify(
      {
        articles: articles.map(({ slug, title, description, date, updated, tags }) => ({
          slug,
          title,
          description,
          date,
          updated,
          tags,
          url: `/articles/${slug}/`,
        })),
      },
      null,
      2,
    )}\n`,
  );
  return { files, articles };
}

// ---- 入出力 ----

export function loadSources(contentDir) {
  if (!existsSync(contentDir)) return [];
  return readdirSync(contentDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => ({
      slug: name.slice(0, -".md".length),
      text: readFileSync(join(contentDir, name), "utf8"),
    }));
}

export function loadSite(publicDir) {
  return JSON.parse(readFileSync(join(publicDir, "data", "site.json"), "utf8"));
}

// public/articles/ の中で、いまの記事に対応しない(削除・下書きに戻した)ページのフォルダ
function staleArticleDirs(publicDir, files) {
  const articlesDir = join(publicDir, "articles");
  if (!existsSync(articlesDir)) return [];
  return readdirSync(articlesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `articles/${entry.name}/index.html`)
    .filter((path) => !files.has(path) && existsSync(join(publicDir, path)));
}

export function writeOutputs(publicDir, files) {
  for (const [path, content] of files) {
    const target = join(publicDir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  for (const path of staleArticleDirs(publicDir, files)) {
    rmSync(dirname(join(publicDir, path)), { recursive: true, force: true });
  }
}

/** 公開ディレクトリの生成物が、原稿から作られるものと一致するか。問題の一覧を返す(空なら最新)。 */
export function checkOutputs(publicDir, files) {
  const problems = [];
  for (const [path, content] of files) {
    const target = join(publicDir, path);
    if (!existsSync(target)) problems.push(`${path}: 生成されていません`);
    else if (readFileSync(target, "utf8") !== content)
      problems.push(`${path}: 原稿と内容が違います`);
  }
  for (const path of staleArticleDirs(publicDir, files)) {
    problems.push(`${path}: 対応する記事がありません(削除するか、原稿を戻してください)`);
  }
  return problems;
}
