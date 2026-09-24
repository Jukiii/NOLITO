// 検索(プロダクト・記事・用語の横断。Phase 20 PR 3)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { footerLinks, mainNav } from "../public/assets/js/config/nav.js";
import { usableProducts } from "../public/assets/js/products/schema.js";
import {
  SEARCH_KINDS,
  allTags,
  buildIndex,
  filterEntries,
} from "../public/assets/js/search/search.js";
import { usableArticles } from "../public/assets/js/updates/updates.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const json = (path) => JSON.parse(read(path));

// 検査用の、作り物のデータ
const product = (overrides = {}) => ({
  id: "sample-app",
  title: "サンプルアプリ",
  description: "サンプルの説明です。",
  url: "/software/sample-app/",
  category: "software",
  tags: ["業務効率化"],
  ...overrides,
});
const article = (overrides = {}) => ({
  slug: "sample",
  title: "サンプル記事",
  description: "記事の説明です。",
  url: "/articles/sample/",
  tags: ["ゲーム"],
  ...overrides,
});
const vocab = (overrides = {}) => ({
  job_id: "engineer",
  job_name: "エンジニア",
  items: [
    {
      id: "engineer-001",
      japanese: "バグ",
      reading: "ばぐ",
      romaji: ["bagu"],
      category: "開発",
      explanation: "プログラムの不具合のこと。",
    },
  ],
  ...overrides,
});

describe("buildIndex(索引を作る)", () => {
  it("プロダクト・記事・用語(すべての職種の items)を、1つの配列にまとめる", () => {
    const index = buildIndex({
      products: [product()],
      articles: [article()],
      vocabularies: [vocab()],
    });
    assert.equal(index.length, 3);
    assert.deepEqual(
      index.map((e) => e.type),
      ["product", "article", "vocabulary"],
    );
  });

  it("プロダクト:id・title・description・url・category・tags を引き継ぐ", () => {
    const [entry] = buildIndex({ products: [product()] });
    assert.equal(entry.id, "product-sample-app");
    assert.equal(entry.title, "サンプルアプリ");
    assert.equal(entry.href, "/software/sample-app/");
    assert.equal(entry.category, "software");
    assert.deepEqual(entry.tags, ["業務効率化"]);
    assert.equal(entry.jobId, null);
  });

  it("記事:category は持たない(null)。tags は引き継ぐ", () => {
    const [entry] = buildIndex({ articles: [article()] });
    assert.equal(entry.type, "article");
    assert.equal(entry.category, null);
    assert.deepEqual(entry.tags, ["ゲーム"]);
  });

  it("用語:遊ぶ先(/games/escape-boss/)にリンクする。タグは持たない。職種を持つ", () => {
    const [entry] = buildIndex({ vocabularies: [vocab()] });
    assert.equal(entry.type, "vocabulary");
    assert.equal(entry.title, "バグ");
    assert.equal(entry.href, "/games/escape-boss/");
    assert.deepEqual(entry.tags, []);
    assert.equal(entry.jobId, "engineer");
    assert.equal(entry.jobName, "エンジニア");
  });

  it("空でも落ちない(引数を省略してもよい)", () => {
    assert.deepEqual(buildIndex(), []);
    assert.deepEqual(buildIndex({}), []);
  });
});

describe("allTags(すべてのタグ)", () => {
  it("プロダクト・記事のタグを、重複なく集める。50音順", () => {
    const index = buildIndex({
      products: [product({ tags: ["こ", "あ"] })],
      articles: [article({ tags: ["あ", "い"] })],
    });
    assert.deepEqual(allTags(index), ["あ", "い", "こ"]);
  });

  it("タグがなければ、空", () => {
    assert.deepEqual(allTags(buildIndex({ vocabularies: [vocab()] })), []);
  });
});

describe("filterEntries(絞り込み)", () => {
  const index = buildIndex({
    products: [
      product(),
      product({ id: "other", title: "べつのソフト", tags: [], category: "tool" }),
    ],
    articles: [article()],
    vocabularies: [vocab()],
  });

  it("キーワードなし・絞り込みなしでも、全件を返す(呼び出し側が、空の状態を別に扱う)", () => {
    assert.equal(filterEntries(index).length, index.length);
  });

  it("キーワードは、題名・説明・タグ・読み・ローマ字にヒットする(大文字小文字を区別しない)", () => {
    assert.equal(filterEntries(index, { query: "サンプルアプリ" }).length, 1);
    assert.equal(filterEntries(index, { query: "業務効率化" }).length, 1);
    assert.equal(filterEntries(index, { query: "ばぐ" }).length, 1);
    assert.equal(filterEntries(index, { query: "BAGU" }).length, 1);
    assert.equal(filterEntries(index, { query: "存在しない語" }).length, 0);
  });

  it("category で絞ると、その性質を持つ項目だけになる(記事・用語には category がないので除かれる)", () => {
    const result = filterEntries(index, { category: "software" });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "product-sample-app");
  });

  it("tag で絞ると、そのタグを持つ項目だけになる", () => {
    const result = filterEntries(index, { tag: "ゲーム" });
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "article");
  });

  it("jobId で絞ると、その職種の用語だけになる(プロダクト・記事は除かれる)", () => {
    const result = filterEntries(index, { jobId: "engineer" });
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "vocabulary");
  });

  it("複数の絞り込みは、すべて満たすものだけ(かつ条件)", () => {
    assert.equal(filterEntries(index, { query: "バグ", jobId: "engineer" }).length, 1);
    assert.equal(filterEntries(index, { query: "バグ", jobId: "sales" }).length, 0);
  });

  it("入力(index)を書き換えない", () => {
    const before = JSON.stringify(index);
    filterEntries(index, { query: "a", category: "b", tag: "c", jobId: "d" });
    assert.equal(JSON.stringify(index), before);
  });
});

describe("SEARCH_KINDS(種類の表示)", () => {
  it("product・article・vocabulary の、すべてに、文字のラベルがある(色だけに頼らない)", () => {
    for (const type of ["product", "article", "vocabulary"]) {
      assert.ok(SEARCH_KINDS[type]?.label.length > 0, type);
      assert.ok(SEARCH_KINDS[type]?.badge.length > 0, type);
    }
  });
});

describe("実際のデータ", () => {
  const categoryData = json("public/data/categories.json");
  const { products } = usableProducts(json("public/data/products.json"), categoryData.categories);
  const { articles } = usableArticles(json("public/data/articles.json"));
  const vocabularies = ["engineer", "sales", "office", "food-service", "teaching", "retail"].map(
    (id) => json(`public/data/vocabulary/${id}.json`),
  );
  const index = buildIndex({ products, articles, vocabularies });

  it("実際のプロダクト・記事・180語すべてが、索引に入る", () => {
    assert.equal(index.filter((e) => e.type === "product").length, products.length);
    assert.equal(index.filter((e) => e.type === "article").length, articles.length);
    assert.equal(index.filter((e) => e.type === "vocabulary").length, 180);
  });

  it("id は、すべて重複しない", () => {
    const ids = index.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("すべてのリンク先(href)は、/ 始まり(サイト内)", () => {
    for (const entry of index) assert.match(entry.href, /^\//, entry.id);
  });

  it("実際の職種すべてで、絞り込める", () => {
    const jobs = json("public/data/jobs.json");
    for (const job of jobs) {
      assert.equal(filterEntries(index, { jobId: job.id }).length, 30, job.id);
    }
  });
});

describe("ページの静的な性質", () => {
  const html = read("public/search/index.html");
  const searchJs = read("public/assets/js/search/search.js");
  const mainJs = read("public/assets/js/search/main.js");
  const css = read("public/assets/css/search.css");

  it("ヘッダーのナビから、検索ページへ行ける", () => {
    assert.ok(mainNav.some((item) => item.href === "/search/" && item.label === "検索"));
  });

  it("検索に載せてよいページ(noindex なし)。題名・説明・canonical がある", () => {
    assert.ok(!html.includes('name="robots"'));
    assert.match(html, /<title>検索 \| NOLITO<\/title>/);
    assert.match(html, /rel="canonical" href="https:\/\/nolito\.pages\.dev\/search\/"/);
  });

  it("フォームは role=search。キーワード入力・送信ボタン(WCAG H32)がある", () => {
    assert.match(html, /role="search"/);
    assert.match(html, /type="search"/);
    assert.match(html, /<button[^>]*type="submit"/);
  });

  it("絞り込み(カテゴリ・タグ・職種)の目印が、HTML と main.js の両方にそろっている", () => {
    for (const hook of ["data-search-category", "data-search-tag", "data-search-job"]) {
      assert.ok(html.includes(hook), `HTML: ${hook}`);
      assert.ok(mainJs.includes(hook), `main.js: ${hook}`);
    }
  });

  it("JavaScript なしでも、その旨が出る(noscript)", () => {
    assert.match(html, /<noscript>/);
  });

  it("HTML として解釈する書き方をしない(表示は、textContent だけ)", () => {
    for (const [name, text] of [
      ["search.js", searchJs],
      ["main.js", mainJs],
    ]) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(text), name);
    }
  });

  it("外部へ通信しない(同じサイトの JSON だけ)。ブラウザに、記録を置かない", () => {
    const all = `${searchJs}\n${mainJs}`;
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(all));
    assert.ok(!/https?:\/\//.test(all));
  });

  it("検索の索引作りは、DOM・保存に触れない純粋な関数のまま(main.js だけが DOM に触れる)", () => {
    assert.ok(!/document\.|window\.|querySelector/.test(searchJs));
  });

  it("フッターには、まだリンクを出さない(検索は、ヘッダーのナビだけ)", () => {
    assert.ok(!footerLinks.some((link) => link.href === "/search/"));
  });

  it("CSS は、色をトークンで指定する", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
  });
});
