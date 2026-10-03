// プロダクト管理の「追加」(Issue #162)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { newProductTemplate } from "../public/assets/js/admin/product-template.js";
import { validateProduct } from "../public/assets/js/products/schema.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");

describe("プロダクト管理の追加", () => {
  it("新規作成のひな形は、サーバーと同じ検証を、そのまま通る(準備中・公開前)", () => {
    const { categories } = JSON.parse(read("public/data/categories.json"));
    const product = JSON.parse(newProductTemplate());
    assert.deepEqual(validateProduct(product, { categories }), []);
    assert.equal(product.status, "coming-soon");
  });

  it("一覧の下に「プロダクトを追加する」ボタンがあり、スクリプトが探す属性は HTML にある", () => {
    const html = read("public/account/admin/products/index.html");
    const script = read("public/assets/js/admin/products-page.js");
    assert.match(html, /<button[^>]*data-admin-products-add>\s*プロダクトを追加する/);
    assert.ok(html.includes("data-admin-products-new"));
    assert.ok(script.includes('"[data-admin-products-add]"'));
    assert.ok(script.includes('"[data-admin-products-new]"'));
  });
});

describe("管理画面の行き来(Issue #162)", () => {
  const pages = {
    top: "public/account/admin/index.html",
    products: "public/account/admin/products/index.html",
    affiliates: "public/account/admin/affiliates/index.html",
    articles: "public/account/admin/articles/index.html",
  };

  it("管理画面のトップがあり、各管理ページへのリンクがある", () => {
    const html = read(pages.top);
    assert.match(html, /<meta name="robots" content="noindex"/);
    assert.ok(html.includes('href="/account/admin/products/"'));
    assert.ok(html.includes('href="/account/admin/affiliates/"'));
    assert.ok(html.includes('href="/account/admin/articles/"'));
    assert.ok(html.includes("/assets/js/admin/hub-page.js"));
  });

  it("すべての管理ページ(トップ含む)に、トップ・各ページ・アカウントへのリンク(今のページは aria-current)", () => {
    for (const [name, path] of Object.entries(pages)) {
      const html = read(path);
      const nav = html.slice(html.indexOf('class="admin-nav"'), html.indexOf("</nav>"));
      for (const href of [
        "/account/admin/",
        "/account/admin/products/",
        "/account/admin/affiliates/",
        "/account/admin/articles/",
        "/account/",
      ]) {
        assert.ok(nav.includes(`href="${href}"`), `${name}: ${href}`);
      }
      assert.equal((nav.match(/aria-current="page"/g) ?? []).length, 1, name);
    }
  });

  it("アカウントのページの管理者向けリンクは、管理画面のトップへ行く", () => {
    assert.match(
      read("public/account/index.html"),
      /data-admin-link[^>]*>\s*<a href="\/account\/admin\/">/,
    );
  });
});
