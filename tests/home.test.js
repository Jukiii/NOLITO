// トップページ(/)のテスト: おすすめ・カテゴリから探す・最新情報(Phase 20 PR 2)。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { usableProducts } from "../public/assets/js/products/schema.js";

const root = fileURLToPath(new URL("../", import.meta.url));
// Windows の作業コピーは、改行が CRLF になる(git の設定による)。LF にそろえて読む
const read = (path) => readFileSync(`${root}${path}`, "utf8").replaceAll("\r\n", "\n");
const json = (path) => JSON.parse(read(path));

describe("実際のデータ", () => {
  const categoryData = json("public/data/categories.json");
  const { products } = usableProducts(json("public/data/products.json"), categoryData.categories);

  it("「おすすめ」に、少なくとも1件出る(featured: true のプロダクトがある)", () => {
    assert.ok(products.some((product) => product.featured));
  });

  it("「カテゴリから探す」に、少なくとも1件出る(一覧ページ(path)があるカテゴリがある)", () => {
    assert.ok(categoryData.categories.some((category) => category.path !== null));
  });
});

describe("ページの静的な性質", () => {
  const html = read("public/index.html");
  const productList = read("public/assets/js/components/product-list.js");
  const categoryList = read("public/assets/js/components/category-list.js");
  const homeMain = read("public/assets/js/home/main.js");

  it("検索に載せてよいページ(noindex なし)。題名・説明・canonical がある。もう「準備中」ではない", () => {
    assert.ok(!html.includes('name="robots"'));
    assert.match(html, /<title>NOLITO\(ノリト\)<\/title>/);
    assert.match(html, /<meta\s+name="description"/);
    assert.match(html, /rel="canonical" href="https:\/\/nolito\.pages\.dev\/"/);
    assert.ok(!html.includes("ただいま準備中です"));
  });

  it("おすすめ・カテゴリから探す・最新情報の目印(HTML と JS の両方)がそろっている", () => {
    for (const hook of [
      "data-product-list",
      "data-featured",
      "data-category-list",
      "data-home-updates",
    ]) {
      assert.ok(html.includes(hook), `HTML: ${hook}`);
    }
    assert.ok(html.includes("data-product-list") && productList.includes("dataset"));
    assert.ok(homeMain.includes("data-home-updates"));
  });

  it("おすすめ(data-featured)は、featured: true のプロダクトだけに絞る", () => {
    assert.match(productList, /featured\s*!==\s*undefined/);
    assert.match(productList, /product\.featured/);
  });

  it("JavaScript なしでも、リンクが出る(noscript)。広告の枠は、非表示", () => {
    assert.match(html, /<noscript>/);
    assert.match(html, /data-ad-slot="page"[^>]*\bhidden\b/);
  });

  it("HTML として解釈する書き方をしない(表示は、textContent だけ)", () => {
    for (const [name, text] of [
      ["product-list.js", productList],
      ["category-list.js", categoryList],
      ["home/main.js", homeMain],
    ]) {
      assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(text), name);
    }
  });

  it("外部へ通信しない(同じサイトの JSON だけ)。ブラウザに、記録を置かない", () => {
    const all = [productList, categoryList, homeMain].join("\n");
    assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(all));
    assert.ok(!/https?:\/\//.test(all));
  });

  it("最新情報は、更新履歴(/updates/)と同じ組み立て(buildUpdates)を再利用する。新しいデータの形は作らない", () => {
    assert.match(homeMain, /from "\.\.\/updates\/updates\.js"/);
    assert.match(homeMain, /buildUpdates\(/);
  });

  it("カテゴリのカードは、一覧ページ(path)があるものだけを出す", () => {
    assert.match(categoryList, /category\.path\s*!==\s*null/);
  });

  it("CSS は、色をトークンで指定する", () => {
    const css = read("public/assets/css/home.css");
    assert.ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(css));
  });
});

describe("すべてのページから、探しやすい", () => {
  it("フッター・ヘッダーのナビから、各カテゴリへ行ける", () => {
    assert.ok(existsSync(`${root}public/games/index.html`));
    assert.ok(existsSync(`${root}public/software/index.html`));
    assert.ok(existsSync(`${root}public/tools/index.html`));
  });
});
