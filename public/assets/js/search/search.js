// 検索(プロダクト・記事・用語の横断。Phase 20 PR 3)。DOM に依存しない、索引作り・絞り込みだけ。
// 新しいデータの形は作らない(products.json・articles.json・vocabulary/*.json を、実行時にまとめる)。

// 種類の表示。種類は色だけでなく、必ず文字でも示す
export const SEARCH_KINDS = {
  product: { label: "プロダクト", badge: "badge--live" },
  article: { label: "記事", badge: "badge--soon" },
  vocabulary: { label: "用語(上司から逃げろ)", badge: "badge--soon" },
};

// 「上司から逃げろ」の用語確認・検索に使う語の、検索用の1件を作る
function vocabularyEntry(item, job) {
  return {
    type: "vocabulary",
    id: `vocabulary-${item.id}`,
    title: item.japanese,
    snippet: item.explanation,
    href: "/games/escape-boss/",
    category: null,
    tags: [],
    jobId: job.job_id,
    jobName: job.job_name,
    // 検索対象の文字(読み・ローマ字・語のカテゴリも、ヒットしてよい)
    haystack: [item.japanese, item.reading, ...item.romaji, item.category, item.explanation]
      .filter(Boolean)
      .join(" "),
  };
}

function productEntry(product) {
  return {
    type: "product",
    id: `product-${product.id}`,
    title: product.title,
    snippet: product.description,
    href: product.url,
    category: product.category,
    tags: product.tags,
    jobId: null,
    jobName: null,
    haystack: [product.title, product.description, ...product.tags].join(" "),
  };
}

function articleEntry(article) {
  return {
    type: "article",
    id: `article-${article.slug}`,
    title: article.title,
    snippet: article.description,
    href: article.url,
    category: null,
    tags: article.tags,
    jobId: null,
    jobName: null,
    haystack: [article.title, article.description, ...article.tags].join(" "),
  };
}

/**
 * 索引を作る(検証済みのデータから)。products・articles は、それぞれの usable*() を通した配列、
 * vocabularies は [{ job_id, job_name, items }] (public/data/vocabulary/*.json の中身)。
 */
export function buildIndex({ products = [], articles = [], vocabularies = [] } = {}) {
  const entries = [
    ...products.map(productEntry),
    ...articles.map(articleEntry),
    ...vocabularies.flatMap((job) => job.items.map((item) => vocabularyEntry(item, job))),
  ];
  return entries;
}

// すべてのタグ(プロダクト・記事から。重複なし・50音/アルファベット順)
export function allTags(entries) {
  const set = new Set(entries.flatMap((entry) => entry.tags));
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

const normalize = (text) => text.toLowerCase();

function matchesQuery(entry, query) {
  if (!query) return true;
  return normalize(entry.haystack).includes(normalize(query));
}

/**
 * 絞り込む。category・tag・jobId は、指定がなければ絞らない(null・undefined・""はすべて無視)。
 * 指定した絞り込みに、その項目が「当てはまらない性質そのものを持たない」種類(用語にタグはない、等)は、除かれる。
 */
export function filterEntries(entries, { query = "", category = "", tag = "", jobId = "" } = {}) {
  return entries.filter((entry) => {
    if (!matchesQuery(entry, query)) return false;
    if (category && entry.category !== category) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    if (jobId && entry.jobId !== jobId) return false;
    return true;
  });
}
