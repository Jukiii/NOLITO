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
