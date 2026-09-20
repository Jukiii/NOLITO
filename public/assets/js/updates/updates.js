// 更新履歴(/updates/)のデータの組み立て。DOM に依存しない純粋な計算。
// 元のデータは、public/data/products.json の changelog と、public/data/articles.json。新しいデータの形は、作らない。
import { formatDate, versionLabel } from "../products/format.js";
import { compareVersions, isSafeUrl, isValidDate } from "../products/schema.js";

// 種類の表示。種類は色だけでなく、必ず文字でも示す
export const UPDATE_KINDS = {
  product: { label: "プロダクトの更新", badge: "badge--live" },
  "article-new": { label: "記事を公開", badge: "badge--soon" },
  "article-update": { label: "記事を更新", badge: "badge--soon" },
};

// 同じ日の並び順(プロダクトの更新 → 記事の公開 → 記事の更新)
const KIND_ORDER = Object.keys(UPDATE_KINDS);

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

// 記事の一覧のデータ(articles.json)。不正な項目だけを外して、残りを返す(1件の間違いで、ページ全体を壊さない)
export function usableArticles(data) {
  if (!isObject(data) || !Array.isArray(data.articles)) {
    return { articles: [], skipped: ["(形式が不正です)"] };
  }
  const articles = [];
  const skipped = [];
  for (const article of data.articles) {
    const valid =
      isObject(article) &&
      typeof article.title === "string" &&
      article.title.trim() !== "" &&
      typeof article.description === "string" &&
      isValidDate(article.date) &&
      (article.updated === null ||
        article.updated === undefined ||
        (isValidDate(article.updated) && article.updated >= article.date)) &&
      // 記事は、このサイトの中のページだけ(外部の URL・javascript: は通さない)
      typeof article.url === "string" &&
      article.url.startsWith("/") &&
      isSafeUrl(article.url);
    if (valid) articles.push(article);
    else
      skipped.push(isObject(article) && typeof article.slug === "string" ? article.slug : "(不明)");
  }
  return { articles, skipped };
}

/** 新しい順の、更新の一覧。products は、検証を通ったもの(usableProducts)、articles は usableArticles の結果。 */
export function buildUpdates({ products, articles }) {
  const entries = [];

  for (const product of products) {
    if (product.status === "coming-soon") continue;
    // 詳細ページがあれば、その更新履歴の節へ。なければ、遊ぶ・使うページへ
    const href = product.detail_path ? `${product.detail_path}#changelog` : product.url;
    for (const entry of product.changelog) {
      entries.push({
        kind: "product",
        date: entry.date,
        title: `${product.title} ${versionLabel(entry.version)}`,
        href,
        changes: [...entry.changes],
        productId: product.id,
        version: entry.version,
      });
    }
  }

  for (const article of articles) {
    entries.push({
      kind: "article-new",
      date: article.date,
      title: article.title,
      href: article.url,
      summary: article.description,
    });
    if (article.updated && article.updated !== article.date) {
      entries.push({
        kind: "article-update",
        date: article.updated,
        title: article.title,
        href: article.url,
        summary: article.description,
      });
    }
  }

  return entries.sort(compareEntries);
}

// 新しい日付が先。同じ日は、同じプロダクトならバージョンの新しい方が先、それ以外は、種類の順・題名の順
function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.productId && a.productId === b.productId) return compareVersions(b.version, a.version);
  const byKind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
  if (byKind !== 0) return byKind;
  return a.title.localeCompare(b.title, "ja");
}

/** 月ごとにまとめる(新しい月が先)。[{ key: "2026-09", label: "2026年9月", entries }] */
export function groupByMonth(entries) {
  const groups = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      const [year, month] = key.split("-").map(Number);
      group = { key, label: `${year}年${month}月`, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

export { formatDate };
