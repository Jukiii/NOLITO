// 更新履歴(/updates/)のテスト: データの組み立て・並び順・月ごとのまとめ・ページの静的な性質。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { footerLinks } from "../public/assets/js/config/nav.js";
import { usableProducts } from "../public/assets/js/products/schema.js";
import {
  UPDATE_KINDS,
  buildUpdates,
  groupByMonth,
  usableArticles,
} from "../public/assets/js/updates/updates.js";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const json = (path) => JSON.parse(read(path));

const realProducts = usableProducts(
  json("public/data/products.json"),
  json("public/data/categories.json").categories,
).products;
const realArticles = usableArticles(json("public/data/articles.json")).articles;

// 検査用の、作り物のデータ
const product = (overrides = {}) => ({
  id: "sample",
  title: "サンプル",
  status: "beta",
  url: "/tools/sample/",
  detail_path: "/tools/sample/about/",
  changelog: [],
  ...overrides,
});
const entry = (version, date, changes = ["変更"]) => ({ version, date, changes });
const article = (overrides = {}) => ({
  slug: "a",
  title: "記事",
  description: "説明",
  date: "2026-09-01",
  updated: null,
  url: "/articles/a/",
  ...overrides,
});

describe("実際のデータ", () => {
  const updates = buildUpdates({ products: realProducts, articles: realArticles });

  it("プロダクトの更新履歴のすべての項目と、記事の公開・更新が、1 件も欠けずに並ぶ", () => {
    const changelogCount = realProducts.reduce((sum, item) => sum + item.changelog.length, 0);
    const articleCount = realArticles.reduce(
      (sum, item) => sum + 1 + (item.updated && item.updated !== item.date ? 1 : 0),
      0,
    );
    assert.ok(changelogCount >= 5, "プロダクトの更新履歴が、実際にある");
    assert.equal(updates.length, changelogCount + articleCount);
  });

  it("新しい順に並んでいる", () => {
    for (let i = 1; i < updates.length; i += 1) {
      assert.ok(
        updates[i - 1].date >= updates[i].date,
        `${updates[i - 1].date} → ${updates[i].date}`,
      );
    }
  });

  it("すべての項目に、種類・日付・題名・サイト内か https のリンクがある", () => {
    for (const item of updates) {
      assert.ok(Object.hasOwn(UPDATE_KINDS, item.kind));
      assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(item.title.length > 0);
      assert.match(item.href, /^(\/(?!\/)|https:\/\/)/, item.href);
    }
  });

  it("プロダクトの更新は、題名にバージョンがつき、詳細ページの更新履歴の節へリンクする", () => {
    const productUpdates = updates.filter((item) => item.kind === "product");
    assert.ok(productUpdates.length > 0);
    for (const item of productUpdates) {
      assert.match(item.title, / v\d+\.\d+\.\d+$/);
      assert.ok(item.changes.length > 0);
      assert.match(item.href, /#changelog$/);
    }
  });

  it("リンク先(詳細ページ・記事)が、実在する(404 を作らない)。#changelog の節も、ある", () => {
    for (const item of updates) {
      const [path, hash] = item.href.split("#");
      const file = `public${path}${path.endsWith("/") ? "index.html" : ""}`;
      assert.ok(existsSync(`${root}${file}`), item.href);
      if (hash) assert.match(read(file), new RegExp(`id="${hash}"`), item.href);
    }
  });

  it("実際の最新バージョンの更新が、その商品の最初(いちばん新しい)に出る", () => {
    for (const item of realProducts.filter((p) => p.changelog.length > 0)) {
      const own = updates.filter((u) => u.productId === item.id);
      assert.equal(own[0].version, item.version, item.id);
    }
  });
});

describe("並び順", () => {
  it("日付の新しい順。同じ日は、プロダクトの更新 → 記事の公開 → 記事の更新", () => {
    const updates = buildUpdates({
      products: [product({ changelog: [entry("1.0.0", "2026-09-10")] })],
      articles: [
        article({ title: "更新した記事", date: "2026-09-01", updated: "2026-09-10" }),
        article({ slug: "b", title: "新しい記事", date: "2026-09-10" }),
      ],
    });
    assert.deepEqual(
      updates.map((item) => `${item.date} ${item.kind}`),
      [
        "2026-09-10 product",
        "2026-09-10 article-new",
        "2026-09-10 article-update",
        "2026-09-01 article-new",
      ],
    );
  });

  it("同じ日に、同じプロダクトの複数のバージョンがあれば、新しいバージョンが先(数として比べる)", () => {
    const updates = buildUpdates({
      products: [
        product({
          changelog: [
            entry("1.9.0", "2026-09-10"),
            entry("1.10.0", "2026-09-10"),
            entry("1.2.0", "2026-09-10"),
          ],
        }),
      ],
      articles: [],
    });
    assert.deepEqual(
      updates.map((item) => item.version),
      ["1.10.0", "1.9.0", "1.2.0"],
    );
  });

  it("入力の並びに、影響されない(毎回、同じ結果)", () => {
    const products = [
      product({ id: "a", title: "い", changelog: [entry("1.0.0", "2026-09-10")] }),
      product({ id: "b", title: "あ", changelog: [entry("1.0.0", "2026-09-10")] }),
    ];
    const forward = buildUpdates({ products, articles: [] }).map((item) => item.title);
    const backward = buildUpdates({ products: [...products].reverse(), articles: [] }).map(
      (item) => item.title,
    );
    assert.deepEqual(forward, backward);
  });

  it("入力のデータを、書き換えない", () => {
    const products = [
      product({ changelog: [entry("1.0.0", "2026-09-10", ["a"]), entry("0.9.0", "2026-09-01")] }),
    ];
    const before = JSON.stringify(products);
    const updates = buildUpdates({ products, articles: [] });
    updates[0].changes.push("書き換え");
    assert.equal(JSON.stringify(products), before);
  });
});

describe("項目の作り方", () => {
  it("準備中のプロダクトは、載せない", () => {
    const updates = buildUpdates({
      products: [product({ status: "coming-soon", changelog: [entry("1.0.0", "2026-09-10")] })],
      articles: [],
    });
    assert.deepEqual(updates, []);
  });

  it("詳細ページがなければ、遊ぶ・使うページへリンクする", () => {
    const [item] = buildUpdates({
      products: [product({ detail_path: undefined, changelog: [entry("1.0.0", "2026-09-10")] })],
      articles: [],
    });
    assert.equal(item.href, "/tools/sample/");
  });

  it("更新日が公開日と同じ・ない記事は、「記事を更新」を出さない", () => {
    const same = buildUpdates({ products: [], articles: [article({ updated: "2026-09-01" })] });
    const none = buildUpdates({ products: [], articles: [article({ updated: null })] });
    assert.equal(same.length, 1);
    assert.equal(none.length, 1);
  });

  it("記事の項目には、説明がつく", () => {
    const [item] = buildUpdates({ products: [], articles: [article()] });
    assert.equal(item.summary, "説明");
    assert.equal(item.changes, undefined);
  });
});

describe("記事のデータの検査(不正な項目だけを外す)", () => {
  const skipReasons = (bad) => usableArticles({ articles: [article(), bad] });

  it("正しい項目は、そのまま通る", () => {
    assert.equal(usableArticles({ articles: [article()] }).articles.length, 1);
  });

  it("日付・題名・説明・URL が不正なものは、外す(ほかは表示する)", () => {
    for (const bad of [
      article({ date: "2026-13-01" }),
      article({ date: "2026/09/01" }),
      article({ title: "" }),
      article({ title: 123 }),
      article({ description: undefined }),
      article({ updated: "2026-08-01" }), // 公開日より前
      article({ updated: "x" }),
      article({ url: undefined }),
      null,
      "文字列",
      [],
    ]) {
      const { articles, skipped } = skipReasons(bad);
      assert.equal(articles.length, 1, JSON.stringify(bad));
      assert.equal(skipped.length, 1);
    }
  });

  it("危険な URL・外部の URL は、外す(記事は、このサイトのページだけ)", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "//evil.test/",
      "https://evil.test/",
      "http://example.com/",
      "articles/no-slash/",
      "/a\nb",
    ]) {
      assert.equal(skipReasons(article({ url })).articles.length, 1, url);
    }
  });

  it("形式が違うデータ全体は、空にする(落ちない)", () => {
    for (const data of [null, undefined, {}, { articles: "x" }, [], "x", 1]) {
      assert.deepEqual(usableArticles(data).articles, []);
    }
  });
});

describe("月ごとのまとめ", () => {
  it("新しい月が先。月をまたいでも、順序を保つ。ラベルは「2026年9月」", () => {
    const updates = buildUpdates({
      products: [
        product({
          changelog: [
            entry("2.0.0", "2026-10-02"),
            entry("1.1.0", "2026-09-20"),
            entry("1.0.0", "2026-09-01"),
          ],
        }),
      ],
      articles: [article({ date: "2025-12-31" })],
    });
    const groups = groupByMonth(updates);
    assert.deepEqual(
      groups.map((group) => [group.key, group.label, group.entries.length]),
      [
        ["2026-10", "2026年10月", 1],
        ["2026-09", "2026年9月", 2],
        ["2025-12", "2025年12月", 1],
      ],
    );
  });

  it("空のときは、空の配列", () => {
    assert.deepEqual(groupByMonth([]), []);
  });

  it("すべての項目が、どれかの月に、1 回ずつ入る", () => {
    const updates = buildUpdates({ products: realProducts, articles: realArticles });
    const grouped = groupByMonth(updates).flatMap((group) => group.entries);
    assert.equal(grouped.length, updates.length);
  });
});

describe("ページの静的な性質", () => {
  const html = read("public/updates/index.html");
  const main = read("public/assets/js/updates/main.js");
  const css = read("public/assets/css/updates.css");

  it("検索に載せてよいページ(noindex なし)。題名・説明・canonical がある", () => {
    assert.ok(!html.includes('name="robots"'));
    assert.match(html, /<title>更新履歴 \| NOLITO<\/title>/);
    assert.match(html, /<meta\s+name="description"/);
    assert.match(html, /rel="canonical" href="https:\/\/nolito\.pages\.dev\/updates\/"/);
  });

  it("フッターからリンクされている。リンク先(ページ)が、実在する", () => {
    assert.ok(footerLinks.some((link) => link.href === "/updates/" && link.label === "更新履歴"));
    assert.ok(existsSync(`${root}public/updates/index.html`));
  });

  it("JavaScript なしでも、その旨が出る(noscript)。広告の枠は、非表示", () => {
    assert.match(html, /<noscript><p>更新履歴の表示には、JavaScript が必要です。<\/p><\/noscript>/);
    assert.match(html, /data-ad-slot="page"[^>]*\bhidden\b/);
  });

  it("HTML として解釈する書き方をしない(表示は、textContent だけ)", () => {
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(main));
    assert.match(main, /from "\.\.\/components\/dom\.js"/);
  });

  it("外部へ通信しない(同じサイトの JSON だけ)。ブラウザに、記録を置かない", () => {
    const urls = [...main.matchAll(/loadJson\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.deepEqual(urls.sort(), [
      "/api/products",
      "/data/articles.json",
      "/data/categories.json",
    ]);
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|https?:\/\//.test(main));
  });

  it("CSS は、色をトークンで指定する", () => {
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
  });

  it("スタイルガイドに、見本がある", () => {
    const guide = read("public/styleguide/index.html");
    assert.match(guide, /updates\.css/);
    assert.match(guide, /class="update__meta"/);
  });
});
