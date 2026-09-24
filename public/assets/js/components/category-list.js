// カテゴリの一覧(トップページの「カテゴリから探す」)。public/data/categories.json から描く。
// 一覧ページ(path)があるカテゴリだけを出す(まだ一覧ページがないカテゴリは、データを足しても出ない)。
import { el } from "./dom.js";

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

export function categoryCard(category) {
  return el(
    "a",
    { class: "card category-card", href: category.path },
    el("h2", { class: "card__title" }, category.name),
    el("p", { class: "card__text" }, category.description),
  );
}

export async function renderCategoryList(container) {
  try {
    const data = await loadJson("/data/categories.json");
    const items = data.categories.filter((category) => category.path !== null);
    container.replaceChildren(...items.map(categoryCard));
  } catch {
    container.replaceChildren(
      el("p", {}, "一覧を読み込めませんでした。ページを再読み込みしてください。"),
    );
  }
}
