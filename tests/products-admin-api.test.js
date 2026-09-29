// プロダクトの管理API(Phase 26 PR 2b。管理者だけ)の通しのテスト。
// /api/admin/products(一覧・新規作成)・/api/admin/products/:id(1件取得・更新・削除)。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  onRequestDelete as deleteProduct,
  onRequestGet as getProduct,
  onRequestPut as putProduct,
} from "../functions/api/admin/products/[id].js";
import {
  onRequestGet as listProducts,
  onRequestPost as createProduct,
} from "../functions/api/admin/products/index.js";
import { SESSION_COOKIE } from "../functions/_lib/config.js";
import { clearJwksCache } from "../functions/_lib/google.js";
import { get, makeEnv, signIn, write } from "./helpers/auth.js";
import { installFakeGoogle } from "./helpers/fake-google.js";

const body = (response) => response.json();
const BASE = "/api/admin/products";

const CATEGORIES_JSON = readFileSync(
  new URL("../public/data/categories.json", import.meta.url),
  "utf8",
);
// 本物の categories.json を、ASSETS 経由で返す偽物(schema.js の検証に、実在のカテゴリが要るため)
const assets = {
  fetch: (url) =>
    String(url).endsWith("/data/categories.json")
      ? new Response(CATEGORIES_JSON, { headers: { "Content-Type": "application/json" } })
      : new Response("not found", { status: 404 }),
};

let env;
let google;

beforeEach(async () => {
  clearJwksCache();
  env = makeEnv({ ADMIN_EMAILS: "alice@example.com" });
  env.ASSETS = assets;
  google = await installFakeGoogle();
});
afterEach(() => google.restore());

/** 管理者(alice@example.com)としてログインする。 */
async function adminCookies() {
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

/** 管理者でない、招待済みの利用者(bob@example.com)としてログインする。 */
async function memberCookies() {
  google.identity = { ...google.identity, email: "bob@example.com" };
  const result = await signIn(env, google);
  return { [SESSION_COOKIE]: result.session.value };
}

const newProduct = (overrides = {}) => ({
  id: "sample-tool",
  category: "tool",
  title: "サンプルツール",
  description: "テスト用の、新しいプロダクト。",
  details: [],
  image: null,
  platforms: ["web"],
  price: { type: "free" },
  status: "released",
  url: "/tools/sample-tool/",
  download: null,
  version: "1.0.0",
  released_at: "2026-09-29",
  updated_at: "2026-09-29",
  changelog: [{ version: "1.0.0", date: "2026-09-29", changes: ["公開"] }],
  tags: [],
  featured: false,
  storage: ["none"],
  plan: null,
  detail_path: null,
  screenshots: [],
  requirements: [],
  faq: [],
  purchase: null,
  ...overrides,
});

describe("GET /api/admin/products", () => {
  it("ログインしていなければ 401", async () => {
    const response = await listProducts({ request: get(BASE), env });
    assert.equal(response.status, 401);
  });

  it("ログイン済みでも、管理者でなければ 403 not-admin", async () => {
    const cookies = await memberCookies();
    const response = await listProducts({ request: get(BASE, { cookies }), env });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "not-admin");
  });

  it("管理者なら、D1(移行済みの2件)の一覧を返す", async () => {
    const cookies = await adminCookies();
    const response = await listProducts({ request: get(BASE, { cookies }), env });
    assert.equal(response.status, 200);
    const data = await body(response);
    assert.deepEqual(
      data.products.map((p) => p.id),
      ["escape-boss", "kii-michi"],
    );
  });
});

describe("POST /api/admin/products", () => {
  it("管理者でなければ 403", async () => {
    const cookies = await memberCookies();
    const response = await createProduct({
      request: write("POST", BASE, { body: { product: newProduct() }, cookies }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("別オリジンからは、CSRF で断る", async () => {
    const cookies = await adminCookies();
    const response = await createProduct({
      request: write("POST", BASE, {
        body: { product: newProduct() },
        cookies,
        headers: { Origin: "https://evil.example" },
      }),
      env,
    });
    assert.equal(response.status, 403);
  });

  it("正しい内容なら、作成でき、一覧に増える。監査ログにも残る", async () => {
    const cookies = await adminCookies();
    const response = await createProduct({
      request: write("POST", BASE, { body: { product: newProduct() }, cookies }),
      env,
    });
    assert.equal(response.status, 201);
    const data = await body(response);
    assert.equal(data.product.id, "sample-tool");

    const list = await listProducts({ request: get(BASE, { cookies }), env });
    assert.deepEqual(
      (await body(list)).products.map((p) => p.id),
      ["escape-boss", "kii-michi", "sample-tool"],
    );

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'product' AND action = 'create'",
    ).first();
    assert.equal(audit.resource_id, "sample-tool");
    assert.equal(audit.before_json, null);
    assert.equal(JSON.parse(audit.after_json).id, "sample-tool");
  });

  it("同じ id が既にあれば 409", async () => {
    const cookies = await adminCookies();
    const response = await createProduct({
      request: write("POST", BASE, {
        body: { product: newProduct({ id: "escape-boss" }) },
        cookies,
      }),
      env,
    });
    assert.equal(response.status, 409);
    assert.equal((await body(response)).error, "product-id-exists");
  });

  it("形式が不正なら 400(details にエラーの一覧)", async () => {
    const cookies = await adminCookies();
    const response = await createProduct({
      request: write("POST", BASE, { body: { product: newProduct({ title: "" }) }, cookies }),
      env,
    });
    assert.equal(response.status, 400);
    const data = await body(response);
    assert.equal(data.error, "invalid-product");
    assert.ok(data.details.length > 0);
  });

  it("product がオブジェクトでなければ 400", async () => {
    const cookies = await adminCookies();
    const response = await createProduct({
      request: write("POST", BASE, { body: { product: "not-an-object" }, cookies }),
      env,
    });
    assert.equal(response.status, 400);
  });
});

describe("GET /api/admin/products/:id", () => {
  it("存在しない id は 404", async () => {
    const cookies = await adminCookies();
    const response = await getProduct({
      request: get(`${BASE}/nope`, { cookies }),
      env,
      params: { id: "nope" },
    });
    assert.equal(response.status, 404);
    assert.equal((await body(response)).error, "product-not-found");
  });

  it("存在すれば、1件を返す", async () => {
    const cookies = await adminCookies();
    const response = await getProduct({
      request: get(`${BASE}/escape-boss`, { cookies }),
      env,
      params: { id: "escape-boss" },
    });
    assert.equal(response.status, 200);
    assert.equal((await body(response)).product.id, "escape-boss");
  });
});

describe("PUT /api/admin/products/:id", () => {
  it("管理者でなければ 403", async () => {
    const cookies = await memberCookies();
    const response = await putProduct({
      request: write("PUT", `${BASE}/kii-michi`, {
        body: { product: newProduct({ id: "kii-michi" }) },
        cookies,
      }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 403);
  });

  it("存在しない id は 404", async () => {
    const cookies = await adminCookies();
    const response = await putProduct({
      request: write("PUT", `${BASE}/nope`, {
        body: { product: newProduct({ id: "nope" }) },
        cookies,
      }),
      env,
      params: { id: "nope" },
    });
    assert.equal(response.status, 404);
  });

  it("URL と本文の id が違えば 400", async () => {
    const cookies = await adminCookies();
    const response = await putProduct({
      request: write("PUT", `${BASE}/kii-michi`, {
        body: { product: newProduct({ id: "escape-boss" }) },
        cookies,
      }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 400);
    assert.equal((await body(response)).error, "product-id-mismatch");
  });

  it("正しい内容なら更新でき、内容が置き換わる。監査ログに変更前後が残る", async () => {
    const cookies = await adminCookies();
    const before = await getProduct({
      request: get(`${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    const beforeProduct = (await body(before)).product;

    const response = await putProduct({
      request: write("PUT", `${BASE}/kii-michi`, {
        body: { product: { ...beforeProduct, title: "キーみち(改)" } },
        cookies,
      }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 200);
    assert.equal((await body(response)).product.title, "キーみち(改)");

    const after = await getProduct({
      request: get(`${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal((await body(after)).product.title, "キーみち(改)");

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'product' AND action = 'update'",
    ).first();
    assert.equal(audit.resource_id, "kii-michi");
    assert.equal(JSON.parse(audit.before_json).title, beforeProduct.title);
    assert.equal(JSON.parse(audit.after_json).title, "キーみち(改)");
  });

  it("形式が不正なら 400", async () => {
    const cookies = await adminCookies();
    const response = await putProduct({
      request: write("PUT", `${BASE}/kii-michi`, {
        body: { product: newProduct({ id: "kii-michi", title: "" }) },
        cookies,
      }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 400);
  });

  it("sort_order は変わらない(一覧の並びを保つ)", async () => {
    const cookies = await adminCookies();
    const before = await env.DB.prepare("SELECT sort_order FROM products WHERE id = ?")
      .bind("kii-michi")
      .first();
    const current = await getProduct({
      request: get(`${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    await putProduct({
      request: write("PUT", `${BASE}/kii-michi`, {
        body: { product: { ...(await body(current)).product, title: "別の題名" } },
        cookies,
      }),
      env,
      params: { id: "kii-michi" },
    });
    const after = await env.DB.prepare("SELECT sort_order FROM products WHERE id = ?")
      .bind("kii-michi")
      .first();
    assert.equal(after.sort_order, before.sort_order);
  });
});

describe("DELETE /api/admin/products/:id", () => {
  it("管理者でなければ 403", async () => {
    const cookies = await memberCookies();
    const response = await deleteProduct({
      request: write("DELETE", `${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 403);
  });

  it("存在しない id は 404", async () => {
    const cookies = await adminCookies();
    const response = await deleteProduct({
      request: write("DELETE", `${BASE}/nope`, { cookies }),
      env,
      params: { id: "nope" },
    });
    assert.equal(response.status, 404);
  });

  it("ログインから10分を過ぎていたら、再ログインを求める(403 reauth-required)。削除しない", async () => {
    const cookies = await adminCookies();
    await env.DB.prepare("UPDATE sessions SET created_at = created_at - 601").run();
    const response = await deleteProduct({
      request: write("DELETE", `${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 403);
    assert.equal((await body(response)).error, "reauth-required");
    const still = await getProduct({
      request: get(`${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(still.status, 200);
  });

  it("削除でき、一覧から消える。監査ログに残る", async () => {
    const cookies = await adminCookies();
    const response = await deleteProduct({
      request: write("DELETE", `${BASE}/kii-michi`, { cookies }),
      env,
      params: { id: "kii-michi" },
    });
    assert.equal(response.status, 200);

    const list = await listProducts({ request: get(BASE, { cookies }), env });
    assert.deepEqual(
      (await body(list)).products.map((p) => p.id),
      ["escape-boss"],
    );

    const audit = await env.DB.prepare(
      "SELECT * FROM admin_audit_log WHERE resource_type = 'product' AND action = 'delete'",
    ).first();
    assert.equal(audit.resource_id, "kii-michi");
    assert.equal(audit.after_json, null);
    assert.equal(JSON.parse(audit.before_json).id, "kii-michi");
  });
});
