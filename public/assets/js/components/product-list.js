// プロダクト(ゲーム・ソフト・ツールなど)の一覧を、public/data/products.json から描く。
// data-product-list の要素に、data-category で指定したカテゴリの ProductCard を並べる。
// データの形と安全性の検証は products/schema.js。不正な項目は外して、他は表示する。
import {
  PRODUCT_STATUS,
  formatDate,
  platformLabels,
  priceLabel,
  versionLabel,
} from "../products/format.js";
import { usableProducts } from "../products/schema.js";
import { el } from "./dom.js";

export { PRODUCT_STATUS };

// 外部のURL(https)は、開いた先にこのページの情報を渡さない
const linkAttributes = (url) => (url.startsWith("/") ? {} : { rel: "noopener noreferrer" });

function metaRow(term, ...content) {
  return el(
    "div",
    { class: "product-card__meta-row" },
    el("dt", {}, term),
    el("dd", {}, ...content),
  );
}

function media(product) {
  if (!product.image) return el("div", { class: "product-card__media", "aria-hidden": "true" });
  return el(
    "div",
    { class: "product-card__media" },
    el("img", { src: product.image.src, alt: product.image.alt, loading: "lazy" }),
  );
}

export function productCard(product) {
  const status = PRODUCT_STATUS[product.status] ?? PRODUCT_STATUS["coming-soon"];
  const available = product.status !== "coming-soon";
  const actions = [];
  if (available) {
    actions.push(
      el(
        "a",
        { class: "button button--primary", href: product.url, ...linkAttributes(product.url) },
        product.cta ?? "見る",
      ),
    );
  }
  // 詳細ページが、遊ぶ・使う先とは別にあるとき(サイト内のページの詳細)
  if (product.detail_path && product.detail_path !== product.url) {
    actions.push(el("a", { class: "button button--secondary", href: product.detail_path }, "詳細"));
  }
  if (product.download) {
    actions.push(
      el(
        "a",
        {
          class: "button button--secondary",
          href: product.download.url,
          ...linkAttributes(product.download.url),
        },
        product.download.label,
      ),
    );
  }
  return el(
    "article",
    { class: "product-card" },
    media(product),
    el(
      "div",
      { class: "product-card__body" },
      el("span", { class: `badge ${status.badge}` }, status.label),
      el("h2", { class: "product-card__title" }, product.title),
      el("p", { class: "product-card__text" }, product.description),
      el(
        "dl",
        { class: "product-card__meta" },
        metaRow("対応", platformLabels(product.platforms).join(" / ")),
        metaRow("価格", priceLabel(product.price)),
        product.version ? metaRow("バージョン", versionLabel(product.version)) : "",
        metaRow(
          "更新",
          el("time", { datetime: product.updated_at }, formatDate(product.updated_at)),
        ),
      ),
      actions.length > 0 ? el("div", { class: "product-card__actions" }, ...actions) : "",
    ),
  );
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

export async function renderProductList(container) {
  const { category } = container.dataset;
  try {
    const [productData, categoryData] = await Promise.all([
      loadJson("/data/products.json"),
      loadJson("/data/categories.json"),
    ]);
    const { products, skipped } = usableProducts(productData, categoryData.categories);
    if (skipped.length > 0) {
      console.warn(`表示できないプロダクトがあります(データの誤り): ${skipped.join(", ")}`);
    }
    const items = products.filter((product) => product.category === category);
    container.replaceChildren(
      ...(items.length > 0
        ? items.map(productCard)
        : [el("p", {}, "まだ公開しているものがありません。")]),
    );
  } catch {
    container.replaceChildren(
      el("p", {}, "一覧を読み込めませんでした。ページを再読み込みしてください。"),
    );
  }
}
