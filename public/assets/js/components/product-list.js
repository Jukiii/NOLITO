// プロダクト(ゲームなど)の一覧を、public/data/products.json から描く。項目は Phase 6 で拡張する。
// data-product-list の要素に、data-category で指定したカテゴリの ProductCard を並べる。
import { el } from "./dom.js";

// 状態の表示。状態は色だけでなく、必ず文字でも示す
export const PRODUCT_STATUS = {
  released: { label: "公開中", badge: "badge--live" },
  beta: { label: "テスト版", badge: "badge--soon" },
  "coming-soon": { label: "準備中", badge: "badge--soon" },
};

export function productCard(product) {
  const status = PRODUCT_STATUS[product.status] ?? PRODUCT_STATUS["coming-soon"];
  const playable = product.status !== "coming-soon";
  return el(
    "article",
    { class: "product-card" },
    el("div", { class: "product-card__media", "aria-hidden": "true" }),
    el(
      "div",
      { class: "product-card__body" },
      el("span", { class: `badge ${status.badge}` }, status.label),
      el("h2", { class: "product-card__title" }, product.title),
      el("p", { class: "product-card__text" }, product.description),
      playable
        ? el("a", { class: "button button--primary", href: product.url }, product.cta ?? "見る")
        : "",
    ),
  );
}

export async function renderProductList(container) {
  const { category } = container.dataset;
  try {
    const response = await fetch("/data/products.json");
    if (!response.ok) throw new Error(String(response.status));
    const { products } = await response.json();
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
