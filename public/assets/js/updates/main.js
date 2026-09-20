// 更新履歴のページ(/updates/)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、すべて el()(textContent 相当)で入れる。データは、公開の JSON(products.json・articles.json)。
import { el } from "../components/dom.js";
import { usableProducts } from "../products/schema.js";
import { UPDATE_KINDS, buildUpdates, formatDate, groupByMonth, usableArticles } from "./updates.js";

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

function updateItem(entry) {
  const kind = UPDATE_KINDS[entry.kind];
  return el(
    "li",
    { class: "update" },
    el(
      "p",
      { class: "update__meta" },
      el("span", { class: `badge ${kind.badge}` }, kind.label),
      el("time", { datetime: entry.date }, formatDate(entry.date)),
    ),
    el("h3", { class: "update__title" }, el("a", { href: entry.href }, entry.title)),
    entry.changes
      ? el("ul", { class: "update__changes" }, ...entry.changes.map((text) => el("li", {}, text)))
      : el("p", { class: "update__text" }, entry.summary),
  );
}

function renderGroups(groups) {
  return groups.map((group) =>
    el(
      "section",
      { class: "updates__month", "aria-labelledby": `updates-${group.key}` },
      el("h2", { class: "updates__month-title", id: `updates-${group.key}` }, group.label),
      el("ol", { class: "updates__list" }, ...group.entries.map(updateItem)),
    ),
  );
}

async function renderUpdates(container) {
  try {
    const [productData, categoryData, articleData] = await Promise.all([
      loadJson("/data/products.json"),
      loadJson("/data/categories.json"),
      loadJson("/data/articles.json"),
    ]);
    const { products, skipped: skippedProducts } = usableProducts(
      productData,
      categoryData.categories,
    );
    const { articles, skipped: skippedArticles } = usableArticles(articleData);
    const skipped = [...skippedProducts, ...skippedArticles];
    if (skipped.length > 0)
      console.warn(`表示できない項目があります(データの誤り): ${skipped.join(", ")}`);

    const groups = groupByMonth(buildUpdates({ products, articles }));
    container.replaceChildren(
      ...(groups.length > 0
        ? renderGroups(groups)
        : [el("p", {}, "まだ、更新の記録がありません。")]),
    );
  } catch {
    container.replaceChildren(
      el("p", {}, "更新履歴を読み込めませんでした。ページを再読み込みしてください。"),
    );
  }
}

for (const container of document.querySelectorAll("[data-updates-list]")) renderUpdates(container);
