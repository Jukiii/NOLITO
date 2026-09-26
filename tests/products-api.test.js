// GET /api/products(Phase 26 PR 2)のテスト。D1(products テーブル)から組み立てる、公開の一覧。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  onRequestGet as getProducts,
  onRequest as anyProducts,
} from "../functions/api/products.js";
import { createDb } from "./helpers/d1.js";

const body = (response) => response.json();
const get = (path = "/api/products") => new Request(`https://nolito.test${path}`);

describe("GET /api/products", () => {
  it("D1(移行済みの2件)から、{ version, products } を組み立てる", async () => {
    const db = createDb();
    const response = await getProducts({ env: { DB: db }, request: get() });
    assert.equal(response.status, 200);
    const data = await body(response);
    assert.equal(data.version, 5);
    assert.deepEqual(
      data.products.map((p) => p.id),
      ["escape-boss", "kii-michi"],
    );
    assert.equal(data.products[0].title, "上司から逃げろ");
  });

  it("公開データとしてキャッシュしてよい(Cache-Control: public)", async () => {
    const db = createDb();
    const response = await getProducts({ env: { DB: db }, request: get() });
    assert.match(response.headers.get("Cache-Control"), /public/);
  });

  it("D1 がない環境(プレビュー等)では、ASSETS 経由で静的な内容にフォールバックする", async () => {
    const calls = [];
    const assets = {
      fetch: (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ version: 5, products: [] }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    };
    const response = await getProducts({ env: { ASSETS: assets }, request: get() });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].endsWith("/data/products.json"), calls[0]);
  });

  it("D1 も ASSETS もない環境では、503", async () => {
    const response = await getProducts({ env: {}, request: get() });
    assert.equal(response.status, 503);
    assert.equal((await body(response)).error, "products-unavailable");
  });

  it("メソッドが違えば 405", async () => {
    const response = await anyProducts({
      env: {},
      request: new Request("https://nolito.test/api/products", { method: "POST" }),
    });
    assert.equal(response.status, 405);
  });
});
