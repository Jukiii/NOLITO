// 記事のページ・一覧ページの HTML を作る。共通のヘッダー・フッターは、他のページと同じ骨格(JS が描画)。
import { escapeHtml, formatDateJa } from "./html.mjs";

const STYLESHEETS = ["tokens", "base", "layout", "components", "articles"];

function timeTag(isoDate) {
  return `<time datetime="${escapeHtml(isoDate)}">${escapeHtml(formatDateJa(isoDate))}</time>`;
}

function tagList(tags) {
  if (tags.length === 0) return "";
  const items = tags.map((tag) => `<li class="tag">${escapeHtml(tag)}</li>`).join("");
  return `<ul class="tag-list" aria-label="タグ">${items}</ul>`;
}

/**
 * ページ全体。canonicalPath は "/articles/xxx/" のようなサイト内のパス。
 * ogType は "article" か "website"。画像は使わない(OGP の画像なし)。
 * stylesheets は、読み込む CSS の名前(既定は記事用)。
 */
export function renderDocument({
  site,
  title,
  description,
  canonicalPath,
  ogType,
  main,
  stylesheets = STYLESHEETS,
}) {
  const fullTitle = `${title} | ${site.name}`;
  const url = `${site.url}${canonicalPath}`;
  return `<!doctype html>
<html lang="${escapeHtml(site.language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:type" content="${escapeHtml(ogType)}" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:site_name" content="${escapeHtml(site.name)}" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
${stylesheets.map((name) => `    <link rel="stylesheet" href="/assets/css/${name}.css" />`).join("\n")}
    <script type="module" src="/assets/js/main.js"></script>
  </head>
  <body>
    <a class="skip-link" href="#main">本文へスキップ</a>
    <header class="site-header" data-site-header>
      <noscript>
        <div class="site-header__inner container">
          <a class="site-logo" href="/">${escapeHtml(site.name)}</a>
        </div>
      </noscript>
    </header>
    <main class="main container" id="main" tabindex="-1">
${main}
    </main>
    <footer class="site-footer" data-site-footer>
      <noscript>
        <div class="container"><small>© ${escapeHtml(site.name)}</small></div>
      </noscript>
    </footer>
  </body>
</html>
`;
}

export function renderArticlePage(article, bodyHtml, site) {
  const updated =
    article.updated && article.updated !== article.date
      ? `<span class="article__updated">更新 ${timeTag(article.updated)}</span>`
      : "";
  const main = `      <article class="article">
        <header class="article__header">
          <p class="article__meta">${timeTag(article.date)}${updated}</p>
          <h1 class="article__title">${escapeHtml(article.title)}</h1>
          ${tagList(article.tags)}
        </header>
        <div class="article__body">
${bodyHtml}
        </div>
        <aside class="ad-slot" data-ad-slot="article" aria-label="広告" hidden></aside>
        <nav class="article__nav" aria-label="記事のナビゲーション">
          <a href="/articles/">← 記事の一覧へ</a>
        </nav>
      </article>`;
  return renderDocument({
    site,
    title: article.title,
    description: article.description,
    canonicalPath: `/articles/${article.slug}/`,
    ogType: "article",
    main,
  });
}

export function renderArticleIndex(articles, site) {
  const cards = articles
    .map(
      (article) => `        <li class="article-card">
          <p class="article-card__meta">${timeTag(article.date)}</p>
          <h2 class="article-card__title"><a href="/articles/${escapeHtml(article.slug)}/">${escapeHtml(article.title)}</a></h2>
          <p class="article-card__text">${escapeHtml(article.description)}</p>
          ${tagList(article.tags)}
        </li>`,
    )
    .join("\n");
  const list =
    articles.length > 0
      ? `      <ul class="article-list">
${cards}
      </ul>`
      : `      <p>まだ記事がありません。</p>`;
  const main = `      <h1>記事</h1>
${list}
      <aside class="ad-slot" data-ad-slot="page" aria-label="広告" hidden></aside>`;
  return renderDocument({
    site,
    title: "記事",
    description: `${site.name}の記事の一覧です。`,
    canonicalPath: "/articles/",
    ogType: "website",
    main,
  });
}
