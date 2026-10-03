// プロダクト管理の入力フォームの変換(product-form.js。純粋)のテスト。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { FIELD_GROUPS, ROW_LISTS } from "../public/assets/js/admin/product-editor.js";
import { newProductTemplate } from "../public/assets/js/admin/product-template.js";
import {
  parseList,
  productToValues,
  valuesToProduct,
} from "../public/assets/js/admin/product-form.js";
import { validateProduct } from "../public/assets/js/products/schema.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(`${root}${path}`, "utf8"));
const { categories } = readJson("public/data/categories.json");
const { products } = readJson("public/data/products.json");

describe("プロダクト ⇔ 入力値の変換", () => {
  it("実際のプロダクトは、入力値にして戻すと、同じ内容になり、検証も通る", () => {
    assert.ok(products.length >= 2);
    for (const product of products) {
      const back = valuesToProduct(productToValues(product));
      assert.deepEqual(back, product, product.id);
      assert.deepEqual(validateProduct(back, { categories }), [], product.id);
    }
  });

  it("新規作成のひな形も、入力値を経由して、検証を通る", () => {
    const template = JSON.parse(newProductTemplate());
    const back = valuesToProduct(productToValues(template));
    assert.deepEqual(validateProduct(back, { categories }), []);
    assert.equal(back.status, "coming-soon");
  });

  it("有料の金額は数になり、無料にすると金額は消える", () => {
    const values = productToValues(products[0]);
    const paid = valuesToProduct({ ...values, priceType: "paid", priceAmount: "980" });
    assert.deepEqual(paid.price, { type: "paid", amount: 980, currency: "JPY" });
    const free = valuesToProduct({ ...values, priceType: "free", priceAmount: "980" });
    assert.deepEqual(free.price, { type: "free" });
  });

  it("空の欄は、null・空の配列になる(空白だけの行は、除かれる)", () => {
    const values = {
      ...productToValues(products[0]),
      imageSrc: " ",
      imageAlt: "",
      downloadLabel: "",
      downloadUrl: "",
      purchaseLabel: "",
      purchaseUrl: "",
      planFree: "\n  \n",
      planPaid: "",
      detail_path: "",
      released_at: "",
      version: "",
      cta: "",
      requirements: [{ label: " ", value: "" }],
      faq: [],
      screenshots: [{ src: "", alt: "", width: "", height: "" }],
      changelog: [],
      details: "",
      tags: "",
    };
    const product = valuesToProduct(values);
    assert.equal(product.image, null);
    assert.equal(product.download, null);
    assert.equal(product.purchase, null);
    assert.equal(product.plan, null);
    assert.equal(product.detail_path, null);
    assert.equal(product.released_at, null);
    assert.equal(product.version, null);
    assert.ok(!("cta" in product));
    assert.deepEqual(product.requirements, []);
    assert.deepEqual(product.screenshots, []);
    assert.deepEqual(product.details, []);
    assert.deepEqual(product.tags, []);
  });

  it("説明は空行で段落に分かれ、変更点・無料の範囲は 1 行ずつ", () => {
    const values = {
      ...productToValues(products[0]),
      details: "一つ目。\n続き。\n\n二つ目。",
      planFree: "A\n B \n\nC",
      changelog: [{ version: "1.0.0", date: "2026-01-01", changes: "x\n\ny" }],
    };
    const product = valuesToProduct(values);
    assert.deepEqual(product.details, ["一つ目。\n続き。", "二つ目。"]);
    assert.deepEqual(product.plan.free, ["A", "B", "C"]);
    assert.deepEqual(product.changelog[0].changes, ["x", "y"]);
  });

  it("入力のしかたの間違い(金額が空など)は、変換で隠さず、サーバーと同じ検証が指摘する", () => {
    const values = { ...productToValues(products[0]), priceType: "paid", priceAmount: "" };
    const errors = validateProduct(valuesToProduct(values), { categories });
    assert.ok(errors.length > 0);
  });

  it("タグは、読点・カンマで区切る", () => {
    assert.deepEqual(parseList("a、b, c，,d "), ["a", "b", "c", "d"]);
    assert.deepEqual(parseList(""), []);
  });
});

describe("入力欄の定義", () => {
  it("入力値のすべての項目に、入力欄(または行の一覧)がある", () => {
    const keys = new Set();
    for (const group of FIELD_GROUPS) for (const field of group.fields) keys.add(field.key);
    for (const list of ROW_LISTS) keys.add(list.key);
    for (const key of Object.keys(productToValues(products[0]))) {
      assert.ok(keys.has(key), key);
    }
  });

  it("行の一覧の列は、入力値の行の項目と一致する", () => {
    const values = productToValues(products[0]);
    for (const list of ROW_LISTS) {
      const row = values[list.key][0];
      if (!row) continue;
      assert.deepEqual(list.columns.map((c) => c.key).sort(), Object.keys(row).sort(), list.key);
    }
  });
});
