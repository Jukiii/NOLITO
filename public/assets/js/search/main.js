// 検索のページ(/search/)。DOM に触れるのは、このファイルだけ。
// 表示する文字列は、すべて el()(textContent 相当)で入れる。データは、公開の JSON だけ。
import { el } from "../components/dom.js";
import { usableProducts } from "../products/schema.js";
import { usableArticles } from "../updates/updates.js";
import { SEARCH_KINDS, allTags, buildIndex, filterEntries } from "./search.js";

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} (${response.status})`);
  return response.json();
}

function resultItem(entry) {
  const kind = SEARCH_KINDS[entry.type];
  const meta = [];
  if (entry.jobName) meta.push(`職種: ${entry.jobName}`);
  if (entry.tags.length > 0) meta.push(entry.tags.join(" / "));
  return el(
    "li",
    { class: "search-result" },
    el(
      "p",
      { class: "search-result__meta" },
      el("span", { class: `badge ${kind.badge}` }, kind.label),
    ),
    el("h2", { class: "search-result__title" }, el("a", { href: entry.href }, entry.title)),
    entry.snippet ? el("p", { class: "search-result__text" }, entry.snippet) : "",
    meta.length > 0 ? el("p", { class: "search-result__extra" }, meta.join(" ・ ")) : "",
  );
}

async function init(root) {
  const $ = (selector) => root.querySelector(selector);
  const form = $("[data-search-form]");
  const input = $("[data-search-input]");
  const categorySelect = $("[data-search-category]");
  const tagSelect = $("[data-search-tag]");
  const jobSelect = $("[data-search-job]");
  const results = $("[data-search-results]");
  const status = $("[data-search-status]");
  const emptyOption = (label) => el("option", { value: "" }, label);

  let index = [];
  try {
    const [productData, categoryData, articleData, jobs, ...vocabularies] = await Promise.all([
      loadJson("/data/products.json"),
      loadJson("/data/categories.json"),
      loadJson("/data/articles.json"),
      loadJson("/data/jobs.json"),
      ...["engineer", "sales", "office", "food-service", "teaching", "retail"].map((id) =>
        loadJson(`/data/vocabulary/${id}.json`),
      ),
    ]);
    const { products } = usableProducts(productData, categoryData.categories);
    const { articles } = usableArticles(articleData);
    index = buildIndex({ products, articles, vocabularies });

    categorySelect.replaceChildren(
      emptyOption("すべてのカテゴリ"),
      ...categoryData.categories.map((category) =>
        el("option", { value: category.id }, category.name),
      ),
    );
    tagSelect.replaceChildren(
      emptyOption("すべてのタグ"),
      ...allTags(index).map((tag) => el("option", { value: tag }, tag)),
    );
    jobSelect.replaceChildren(
      emptyOption("すべての職種"),
      ...jobs.map((job) => el("option", { value: job.id }, job.name)),
    );
  } catch {
    status.textContent = "検索の準備ができませんでした。ページを再読み込みしてください。";
    return;
  }

  // アドレスの ?q=...&category=...&tag=...&job=... から、初期状態を復元する
  const params = new URLSearchParams(location.search);
  input.value = params.get("q") ?? "";
  categorySelect.value = params.get("category") ?? "";
  tagSelect.value = params.get("tag") ?? "";
  jobSelect.value = params.get("job") ?? "";

  function render() {
    const query = input.value.trim();
    const filters = {
      query,
      category: categorySelect.value,
      tag: tagSelect.value,
      jobId: jobSelect.value,
    };
    const entries = filterEntries(index, filters);

    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filters.category) next.set("category", filters.category);
    if (filters.tag) next.set("tag", filters.tag);
    if (filters.jobId) next.set("job", filters.jobId);
    const search = next.toString();
    history.replaceState(null, "", search ? `?${search}` : location.pathname);

    if (!query && !filters.category && !filters.tag && !filters.jobId) {
      status.textContent = "キーワードを入力するか、絞り込みを選んでください。";
      results.replaceChildren();
      return;
    }
    status.textContent = `${entries.length}件見つかりました。`;
    results.replaceChildren(...entries.map(resultItem));
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  input.addEventListener("input", render);
  for (const select of [categorySelect, tagSelect, jobSelect]) {
    select.addEventListener("change", render);
  }
  render();
}

const root = document.querySelector("[data-search]");
if (root) init(root);
