// トップページ(/)の「最新情報」。DOM に触れるのは、このファイルだけ。
// 元のデータ・組み立ては /updates/ と同じ(products.json の changelog・articles.json)。新しいデータの形は作らない。
import { el } from "../components/dom.js";
import { usableProducts } from "../products/schema.js";
import { UPDATE_KINDS, buildUpdates, formatDate, usableArticles } from "../updates/updates.js";

const MAX_ITEMS = 5;

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

function updateItem(entry) {
  const kind = UPDATE_KINDS[entry.kind];
  return el(
    "li",
    { class: "update update--compact" },
    el(
      "p",
      { class: "update__meta" },
      el("span", { class: `badge ${kind.badge}` }, kind.label),
      el("time", { datetime: entry.date }, formatDate(entry.date)),
    ),
    el("h3", { class: "update__title" }, el("a", { href: entry.href }, entry.title)),
  );
}

export async function renderHomeUpdates(container) {
  try {
    const [productData, categoryData, articleData] = await Promise.all([
      loadJson("/api/products"),
      loadJson("/data/categories.json"),
      loadJson("/data/articles.json"),
    ]);
    const { products } = usableProducts(productData, categoryData.categories);
    const { articles } = usableArticles(articleData);
    const entries = buildUpdates({ products, articles }).slice(0, MAX_ITEMS);
    container.replaceChildren(
      ...(entries.length > 0
        ? entries.map(updateItem)
        : [el("p", {}, "まだ更新の記録がありません。")]),
    );
  } catch {
    container.replaceChildren(
      el("p", {}, "最新情報を読み込めませんでした。ページを再読み込みしてください。"),
    );
  }
}

const container = document.querySelector("[data-home-updates]");
if (container) renderHomeUpdates(container);
